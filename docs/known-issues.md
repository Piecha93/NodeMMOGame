# Known issues

This is the refactor baseline. It separates fixes made in the foundation change from work that is still open; remaining items are ordered by operational risk rather than by file or age.

## Fixed in the foundation change

- Input snapshots now reject malformed structures, unknown or duplicate commands, oversized payloads, unsafe IDs, non-finite values and out-of-range coordinates before mutating player state.
- Duplicate and stale input snapshots are ignored, and a player gets only one snapshot-cleanup listener.
- Client readiness is idempotent; disconnect cleanup removes the player and client-owned maps, and duplicate sessions close the previous socket.
- Chat, input and heartbeat events have per-client limits, transport messages are capped at 16 KiB, debug commands are disabled by default, and commands requiring a player are ignored before readiness.
- Heartbeats continue on a timer even when a response is lost, while stale pending heartbeat entries are discarded.
- Sender names in browser chat are inserted as text rather than HTML.
- Rectangular chunk grids are iterated and linked using their actual column lengths.
- Collision-exit events identify the pair that stopped colliding, polygon colliders follow transform rotation, and the object factory rejects unknown prefabs and non-finite positions with controlled errors.
- Prefab registration now has an explicit, idempotent client/server bootstrap instead of depending on a circular module side effect.

Parser, input-handler, rectangular-grid, collision-exit, factory, rate-limit, heartbeat, debug-action and socket-handler lifecycle failures have automated regression tests. Real Socket.IO transport and browser DOM behavior still need end-to-end coverage.

## Fixed in the instance-owned world change

- Every `GameCore` now owns its object manager, factory, object map, ID sequence and lifecycle subscriptions. Server, client, renderer, input, weapons, chunks and serializers receive or follow that owned runtime instead of using global registry state.
- Two cores can use the same generated ID without sharing an object or chunk. Destroying or disposing one core does not mutate the other, and this isolation has an automated regression test.
- Duplicate explicit IDs cannot overwrite a live registry entry. Published IDs are immutable, explicit IDs must match their prefab prefix, generated IDs skip occupied values, failed create subscriptions roll back, and destroy cleanup continues through listener errors.
- Default prefab wire prefixes are explicitly fixed at `A` through `H`, rather than being assigned implicitly by import order.
- Chunk reload uses the owning core's factory. Server destroy tombstones use the object's recorded old chunk, are deduplicated, and are cancelled when reload restores the same wire ID.
- Cross-chunk updates preserve pending object state while every target frame is built and commit it once afterward. Movement in either chunk-iteration direction now sends the same complete record to the old leaver frame and the new chunk frame without repeating it in the next unchanged collection.

## Fixed in the protocol-negotiation change

- The v1 `SocketMsgs` application codes are explicit and frozen at `0` through `11`; Socket.IO's `connection` and `disconnect` transport names remain unchanged.
- `CLIENT_READY` advertises supported protocol versions. The server selects the highest common version, stores it per `ServerClient` and echoes it in `INITIALIZE_GAME`, which the browser validates and stores.
- Missing negotiation fields map to legacy v1 in both directions, preserving rolling compatibility with the previous client and server. Malformed and unsupported offers disconnect cleanly before a player is created.

## Critical before public deployment

- Registered-user passwords use the historical plain-text schema. Registered login must remain disabled outside trusted development until hashes and a migration exist.
- Realtime payload checks are implemented at individual handlers and the connection negotiates v1, but there is no complete per-message schema or fuzz/integration suite proving every transport boundary.
- Debug commands are development-gated and rate-limited, but the server still exposes historical debug/gameplay paths that need a deliberate production threat review.
- The project has not been load-tested and has no production monitoring or persistent session store.

The current Tailscale guest deployment is a development preview, not a public production service.

## Correctness and lifecycle

- `SharedConfig`, including client/server origin and chunk dimensions, remains process-wide. World object state is isolated, but two cores in one JavaScript realm are not independently configurable runtimes.
- The prefab catalog remains global. Default mappings `A` through `H` are stable and duplicate-checked, but dynamically registering a prefab still affects every core in the process.
- Disconnect/reconnect, duplicate readiness and heartbeat loss have defensive code plus socket-handler tests, but still need end-to-end coverage with real Socket.IO clients.
- Collector-level movement fan-out is covered in both chunk-iteration directions; per-client visibility and interest transitions still need end-to-end coverage with real Socket.IO clients.
- Most code compiles without strict null and indexed-access checking; strict diagnostics currently reveal a substantial backlog.

## Build and client

- `npm run build` now creates `dist/public/game.js` from the current `client/Launcher.ts` source, and Express exposes that artifact at `/build/game.js`.
- A build regression checks the artifact, its source map, the npm PixiJS source and the browser view, so CI fails if the executable client falls out of sync with current source or falls back to the removed browser global.
- Rendering uses PixiJS 8.19.0 and explicitly targets WebGL. The checked-in PixiJS 4 build and separate script tag have been removed.
- Asset manifest and animation-frame classification are deterministic and can be covered without pretending that Node.js exercises a GPU. Pixel output does not yet have an automated, pinned-browser baseline; follow the manual renderer comparison in [Testing](testing.md) for renderer changes.
- The generated client and server now use matching Socket.IO 4 packages, so Engine.IO 3 compatibility is no longer enabled. The manual guest-login smoke path covers local and proxied Socket.IO initialization; automating it remains open.

## Protocol

- The connection explicitly negotiates v1, but the selected version is not embedded in each binary frame.
- String fields use a one-byte length and one byte per JavaScript code unit. Non-ASCII text is corrupted and strings are effectively limited to 255 code units.
- V1 object and update frames have no explicit total-frame length, record count, schema hash or complete bounds contract.
- Object IDs and property masks rely on implicit sizes. Default prefab IDs are now explicit, but the global catalog has no versioned compatibility contract for additional mappings.

UTF-8 is deliberately not patched into v1: the generated browser client and server now negotiate that version specifically to preserve its legacy bytes. UTF-8, explicit framing and stronger bounds belong in a coordinated v2 codec with a dual-version deployment window.

## Quality and documentation gaps

- The foundation suite covers only a small part of the simulation; real Socket.IO, browser, visual-regression, database and load tests remain to be added.
- Linting, formatting, coverage thresholds and a strict-TypeScript ratchet are not yet configured.
- Gameplay controls, a complete v1 frame reference, deployment operations and security procedures still need dedicated documentation.

## First-stage exit criteria

The foundation stage is complete when:

- CI installs, checks, builds, tests and audits from a clean checkout;
- malformed and repeated socket events cannot crash or leak server state;
- every confirmed P0/P1 bug has a regression test;
- the browser bundle is generated from the current client source; **complete and enforced in CI**;
- the documented guest-login smoke path works on a clean machine;
- known protocol incompatibilities have an explicit migration plan.
