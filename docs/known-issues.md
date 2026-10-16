# Known issues and compatibility limits

The refactor establishes explicit world ownership, fixed stepping, versioned serialization and application lifecycle. The limits below describe remaining evidence or compatibility work; passing CI is not a production-capacity claim.

## Deliberate compatibility boundaries

- V1 remains available for rolling upgrades and retains its historical one-byte/code-unit string encoding. Non-ASCII names are reliable through v2's UTF-8 codec; changing v1 string bytes would break old peers. Its implicit masks and legacy field layout remain guarded by golden fixtures.
- The v2 codec validates whole bounded snapshot batches before application, and the runtime adapter checks referenced objects/prefabs. Arbitrary gameplay/lifecycle exceptions during application do not have a general transactional world rollback. A controlled disconnect/recovery boundary is still necessary for such runtime failures.
- `SharedConfig` and legacy registries remain compatibility construction entrypoints. Live worlds use their captured context and own prefab catalogs; they are independently configurable. New code should pass explicit world options instead of mutating legacy defaults.
- `detect-collisions` remains pinned to 2.7.0. Position/rotation/scale and lifecycle regressions are in place, but changing the collision engine's API/behavior is a separate migration. The current solver is discrete; fast-object tunnelling and historical hit validation require gameplay-specific work if those mechanics demand it.

## Deployment and accounts

- Successful legacy login atomically replaces plaintext with a scrypt hash. Dormant accounts retain their old password field until migrated or reset. Plan an inventory/reset or offline migration before treating the database as free of historical plaintext.
- Registration, account recovery and password-reset UI are not implemented. Existing registered accounts and guest development are supported; see [Authentication](authentication.md).
- Production requires HTTPS, a stable secret and persistent sessions. Mongo persistence is implemented and tested through the adapter contract; deployment still needs backups, restore checks, secret rotation and environment-specific proxy configuration.
- The application login limiter and game session ownership are local to one process. Horizontal deployment requires shared rate limits/socket coordination and an explicit world-routing strategy. The current architecture does not claim distributed simulation or sharding.
- Debug gameplay actions remain opt-in. Public exposure still needs a deployment-specific threat review and operational policies for guests, abuse and account lifecycle.

## Integration evidence still to extend

- Real HTTP/session/socket tests cover login, logout, revoked reconnect, both v1 transports and mixed v2/v1 tick ACK/STOP/state delivery. V2 authoritative queue/interest tests cover its wider state-machine behavior; large mixed-client deployments and a long reconnect/heartbeat-loss matrix are not yet measured.
- Decoder tests include deterministic malformed-frame fuzzing and explicit bounds; this is not an exhaustive fuzzing campaign over every transport/parser interaction.
- Client resource, disposal, culling, smoothing and interpolation contracts have automated tests. A pinned Chromium fixture renders a deterministic scene, validates nonblank pixels and compares PNGs before/after remount within one run. It does not persist golden images across commits; versioned visual baselines and full automated gameplay/proxy smoke remain separate work.
- Runtime lifecycle tests exercise restart and cleanup. Long-duration soak tests with many real client sessions are still needed to detect growth that a short regression suite cannot show.

## Performance and operations

The project has no measured production concurrency or bandwidth budget. Before optimizing or making capacity claims, profile simulation and collision time, catch-up/dropped time, event-loop lag, per-client replication bytes, Mongo latency, retained memory and browser frame time under realistic play.

The development [performance world](performance.md) now exposes a bounded enemy population, simulation tick percentiles, discarded time, snapshot payload rate and browser FPS. Its different distributions separate local rendering pressure from world simulation. It is an interactive diagnostic, not a concurrency/soak benchmark.

`droppedTimeMs` makes discarded simulation backlog visible, but production dashboards, alert thresholds, readiness/health integration and incident procedures are not configured. Application logging and a green development smoke do not supply those operating guarantees.

Remote actor rendering intentionally interpolates about 100 ms behind authoritative snapshots and holds the newest sample during a longer outage. Straight projectiles use a continuous presentation clock from their first sample, bounded to 80 ms beyond the newest authoritative state. They stop at that bound during an outage and disappear on the server's destroy record. This avoids waiting for a second sample at spawn but does not predict the local shot before server acknowledgement. Historical rewind/lag compensation for hit detection is not implemented; add it only with explicit combat requirements and server-side history/latency tests. Source-engine UDP tuning guidance does not directly apply to Socket.IO's reliable ordered channel.

## Refactor changes already covered

The former global object registry/configuration coupling, implicit demo startup, unowned application timers, plaintext authentication path after a successful migration, missing persistent-session option, non-versioned-only networking and missing strict checks are no longer open baseline blockers.

Regression coverage now includes stable tick iteration/spawn timing, collision cleanup/self filtering/scale, per-world catalog/configuration isolation, complete/delta and legacy framing, bounded UTF-8 v2 batches, sequence wrap, processed-input acknowledgements, prediction/replay, per-client interest records, client disposal/resource reuse, session rotation/revocation and dependency/build consistency. [Testing](testing.md) explains which boundaries use real infrastructure and which use controlled fixtures.
