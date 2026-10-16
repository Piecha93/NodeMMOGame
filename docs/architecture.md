# Architecture

This describes the current refactor and its compatibility boundaries. It does not claim production capacity or pixel equivalence without the checks in [Testing](testing.md).

## Runtime and dependency boundaries

```mermaid
flowchart LR
    Browser["Client: input, prediction, presentation, PixiJS"]
    HTTP["Application: HTTP, authentication, sessions"]
    Transport["Socket.IO: negotiated v1/v2/v3"]
    Server["GameServer: sessions, input queues, scheduling"]
    Protocol["Protocol: DTOs, validation, bounded codecs"]
    Replication["Per-client replication and domain adapter"]
    Core["GameCore: world, objects, movement, collisions, chunks"]
    Mongo["MongoDB: users and persistent sessions"]

    Browser <-->|"HTTP"| HTTP
    Browser <-->|"realtime"| Transport
    Transport --> Server
    Server --> Core
    Server --> Replication
    Browser --> Protocol
    Replication --> Protocol
    Replication --> Core
    HTTP --> Mongo
```

`shared/` means portable code used in both processes. Its internal boundaries matter more than the directory name:

| Area | Responsibility |
| --- | --- |
| `shared/core/`, objects, physics and chunks | Runtime context, game state, movement and simulation. |
| `shared/protocol/` | Validated transport DTOs, sequence arithmetic and v2/v3 encoding/decoding. No live-world mutation. |
| `shared/replication/` | Domain/state projection, snapshot application and each client's visibility baseline. |
| `shared/serialize/` | Legacy v1 compatibility metadata, codec, preflight and chunk snapshot bridge. |
| `server/` | Application composition, authenticated connections, scheduling and persistence. |
| `client/` | Browser input/UI, prediction, interpolation, renderers and resources. |

Separate TypeScript configurations and import-boundary checks prevent browser/server dependencies from leaking into portable modules. A single repository is sufficient; publishing packages, introducing an ECS and changing transport are not prerequisites for these boundaries.

## World ownership and fixed simulation

Every `GameCore` owns a `WorldContext`, object manager, factory, prefab catalog, chunks, collision system and update collector. The context captures immutable configuration plus injected clock and random functions. Runtime role, chunk dimensions and timers follow the owning context rather than mutable process-wide client/server flags. The remaining `SharedConfig` API supplies legacy construction defaults; changing it after construction does not reconfigure a live world.

```ts
const core = new GameCore({
    role: Origin.SERVER,
    fixedDeltaMs: 1000 / 64,
    maxCatchUpSteps: 8,
    chunkSize: 1280,
    numOfChunksX: 5,
    numOfChunksY: 5,
    clock,
    random,
});

core.step();            // One simulation step with the configured duration.
core.advance(elapsed);  // Accumulate elapsed time into bounded fixed steps.
```

The default simulation frequency is 64 Hz. `advance()` limits catch-up to eight steps and records discarded backlog in `droppedTimeMs`. Chunk deactivation follows simulation `timeMs`, so explicit stepping produces the same world lifecycle regardless of wall-clock pace. Connection/session expiry still uses real time. Rendering and network snapshot scheduling are separate from simulation stepping. Tests can drive the same world without sleeping or starting application timers.

At the beginning of a world update, the runtime captures a stable set of objects. Destroying an object cannot skip the following object; objects destroyed before their turn are ignored, and spawned objects begin their updates on the next tick. Collision batches also tolerate lifecycle mutation. Source/target registration is rechecked after callbacks, current contacts remain reachable by cleanup, and colliders sharing one parent are filtered out. Collider geometry follows position, rotation and scale changes.

Object registration is transactional at the registry boundary. Factories reject unknown prefabs, invalid positions and conflicting IDs; failed creation subscribers trigger cleanup. Destruction removes registry entries before subscriber delivery and continues cleanup through listener errors. Subscriptions receive paired lifecycle notifications. Core disposal is idempotent and remains isolated from other worlds, including worlds using the same object ID.

Default prefab mappings stay explicit:

| Prefix | Prefab |
| --- | --- |
| `A` | `DefaultPlayer` |
| `B` | `Michau` |
| `C` | `Wall` |
| `D` | `HpPotion` |
| `E` | `Doors` |
| `F` | `FireBall` |
| `G` | `Portal` |
| `H` | `PlatformTriggerTest` |
| `I` | `ExpeditionMarker` (new expedition) |

## Protocol and serialization

Protocol negotiation is connection context. New clients advertise `[3, 2, 1]`; the server selects the highest common version and echoes it in initialization. Missing fields in either direction map to v1 for a rolling upgrade. Malformed and unsupported offers fail before creating a player. Application event codes remain frozen at `0` through `11`; Socket.IO's own connection/disconnect events remain transport names.

V2 uses plain DTOs and explicit schema definitions. Prefab, field and type IDs do not depend on decorator execution, import order or runtime property enumeration. Text uses bounded UTF-8. Frames carry a version, lengths, record count, server tick, snapshot identity, input acknowledgement and batch metadata. Records identify create/update/destroy semantics; a complete local-player state accompanies reconciliation.

V3 carries the same DTOs using a separate compact codec: a combined kind/prefab tag, canonical unsigned varints for entity sequences and integers, and a field mask whose bits refer to explicit schema IDs. Remote floating-point values use float32; the complete authoritative local player uses float64 so reconciliation retains simulation precision. At the schema's coordinate limit of ±1,000,000, float32 rounding is at most 1/32 pixel. V1 and V2 bytes stay unchanged. See the [wire format](../shared/protocol/README.md).

`encodeSnapshot()` splits a snapshot at record boundaries. Current limits are 64 KiB per frame, 256 records per frame, 256 batches and 8 MiB per complete snapshot. Field schemas impose tighter bounds where needed. Unknown fields/types, invalid numbers and IDs, malformed UTF-8, truncation, inconsistent batches and oversized input fail with controlled protocol errors.

`decodeSnapshot()` validates the complete batch before application. The domain adapter also preflights object existence and prefab compatibility before mutating the world. This prevents a malformed tail or missing batch from partially applying a snapshot. Arbitrary exceptions inside user gameplay/lifecycle callbacks are not a general-purpose rollback transaction and remain a separate operational failure boundary.

V1 remains available with its historical record bytes. Its one-byte/code-unit string encoding, implicit field ordering and mask representation cannot be changed in place. External compatibility metadata and the legacy bridge preserve those contracts while domain objects use `ReplicatedState` for change bookkeeping. The v2 schema is independent of this legacy machinery. V1 golden fixtures, inherited-field tests, mask boundaries and bounded frame splitting protect the fallback.

Chunk deactivation serializes persistent objects through the owning world's bridge and removes live instances; reload uses that world's factory and preserves wire IDs. Server tombstones follow the recorded old chunk and are cancelled when the same ID is restored. Legacy update collection preserves pending changes while every target frame is built, then commits once, so encoding failure remains retryable.

## Authoritative input, prediction and visibility

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    C->>S: InputCommand(sequence, movement, actions)
    S->>S: Validate and queue
    S->>S: Consume command on simulation tick
    S->>C: Snapshot(tick, lastProcessedInputSeq, player state, records)
    C->>C: Restore authoritative player state
    C->>C: Drop acknowledged commands and replay remaining movement
    C->>C: Interpolate remote presentation
```

The server owns simulation duration; clients cannot submit their own delta or position as authoritative state. Received commands are acknowledged only after the tick that consumes them. Sequence comparison handles uint32 wrap. Server input queues and client prediction history are bounded at 256 commands. Discrete actions execute on the server once and are excluded from local movement replay.

`ReplicationSession` owns a baseline per connection. The current chunk and its neighbors define the candidate set. V3 further filters it to a rectangle extending 768 pixels horizontally and 512 vertically around the player, including conservative object bounds. This covers the 1024×576 viewport, camera look-ahead and prefetch; already known objects receive an extra 96 pixels of exit hysteresis. V1/V2 retain their original interest. Entering objects receive complete create records, changed visible objects receive updates, and leaving/destroyed objects receive removal records. The next baseline commits after successful encoding; another client's interest transition does not consume that state. Immutable entity captures are shared only within one publication; baselines and transitions remain independent.

Local v2/v3 prediction restores authoritative state, retires acknowledged commands and replays pending movement through shared movement/collision code. Remote presentation uses `SnapshotInterpolator`: a 100 ms interpolation delay, at most 32 samples per entity, and a hold on the newest known position when data stops arriving. The renderer's smoothing depends on elapsed time and does not select presentation classes from network ID prefixes.

Legacy clients retain v1 input/reconciliation semantics, with regressions for STOP retries, idle acknowledgements, collision geometry and leaving/returning interest. V2 is the path for tick/sequence-based synchronization; it does not reinterpret legacy timestamps in place.

Socket.IO remains a reliable ordered transport. UDP packet-loss assumptions from Source networking do not directly describe its application channel. Historical hit rewind/lag compensation is a separate gameplay feature, not a prerequisite for local movement reconciliation.

## Application and client lifecycle

`createApplication()` composes Express, session middleware, Socket.IO, the user repository and `GameServer`. Construction/import does not listen or start simulation timers. Start and stop are idempotent; startup failure closes owned resources; restart creates a fresh runtime. SIGINT/SIGTERM use the same shutdown. `GameServer` owns timer handles and its connection subscription, removes client maps even through destroy errors, and disposes its core. Demo world seeding is a scenario option rather than an implicit effect of starting any server instance.

`GameClient.dispose()` cancels RAF/input/network timers, removes callbacks/listeners, closes the socket and releases the renderer/core. Async renderer initialization handles disposal before completion. Resource registration/loading is idempotent for the same resource definition, so recreating the renderer does not duplicate assets or animation frames.

Authentication uses injected `UserRepository` and session-store contracts. Mongo connections expose explicit connect/close. Login regenerates session identifiers; logout destroys the store record and disconnects that session's sockets. Registered credentials use salted scrypt with atomic legacy migration. See [Authentication and lifecycle](authentication.md).

## Deliberate limits

The collision library remains pinned to 2.7.0. Engine replacement, broad gameplay changes, lag compensation, horizontal sharding and an ECS require their own evidence and compatibility decisions. Production capacity, long-running stability and GPU pixel equivalence require the measurements described in [Testing](testing.md) and [Known issues](known-issues.md).
