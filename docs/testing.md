# Testing

The application and tests use the locked TypeScript compiler and Node.js's built-in test runner. CI selects Node.js 24 LTS through `.nvmrc`.

## Local quality gate

```sh
npm ci
npm run check
npm run check:boundaries
npm run format:check
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm audit --audit-level=high
```

Strict TypeScript and checked indexed access apply to the source boundaries. Import rules prevent portable core/protocol code from depending on browser or server infrastructure. The formatting gate uses the repository's committed formatter configuration; `npm run format` applies it.

Test fixtures retain strict checking but relax indexed-access checking in `tsconfig.test.json`; the separate source checks continue to enforce it. Browser fixture code has its own strict compiler configuration.

Build before running the full suite: build tests inspect the fresh browser bundle, its source map and `game.ejs`. Test compilation uses `dist-test/`, separate from runnable `dist/`. The normal build/test scripts clean only their own generated directories; coordinate those cleaning commands when multiple processes share a checkout.

For a focused run after changes:

```sh
npm run test:compile
node --test dist-test/tests/collisions.test.js dist-test/tests/foundation/world-update.test.js
```

Tests should prove behavior at the changed boundary. Add a failing reproduction before fixing a confirmed bug; keep compatibility fixtures when moving code. Do not replace assertions with broad casts or unchecked non-null assumptions just to satisfy the compiler.

## Coverage by boundary

| Location | What it exercises |
| --- | --- |
| `tests/foundation/` | Isolated worlds/configuration/catalogs, fixed-step accumulation, object lifecycle, chunks, collisions and legacy binary compatibility. |
| `tests/protocol/` | Explicit schemas, UTF-8, bounds, all-frame truncation, malformed data, batching, deterministic decoder fuzzing, sequence wrap and the legacy adapter boundary. |
| `tests/socket/` | Handler validation/rate limits, connection lifecycle, real polling/WebSocket v1 and mixed v2/v1 state/ACK/STOP transport, plus v2 authoritative queue/interest behavior. |
| `tests/client/` | Input delivery/disposal, prediction/replay, interpolation, interest transitions, presentation, resource lifecycle and binary normalization. |
| `tests/application/`, `tests/auth/` | Real HTTP/session/socket integration, application start/stop/rollback, credentials, password migration and optional real Mongo persistence. |
| `tests/build/` | Current-source browser artifact, npm PixiJS provenance and view entrypoint. |
| `tests/browser/` | Real PixiJS WebGL rendering, nonblank pixel metrics and equal PNG output after disposal/remount in one pinned Chromium run. |

The world tests drive identical command ticks under different render schedules and compare the resulting state. Catch-up tests bound work and account for discarded time. Lifecycle tests cover destruction during update/collision, spawn timing, cleanup after listener errors, duplicate IDs and independent worlds using the same IDs.

V1 tests preserve complete/delta bytes, inherited field ordering, mask-width boundaries, legacy string limits, nested encoding failure/retry and complete cross-chunk fan-out. Decoder preflight must reject a malformed tail without constructing or publishing objects. Legacy Unicode behavior remains deliberately frozen; v2 carries UTF-8 correctness coverage.

V2 tests cover each prefab, stable IDs, bounded UTF-8 and numeric values, unknown fields/types, every truncation, malformed/duplicate batches, total snapshot limits and controlled errors under deterministic malformed-frame fuzzing. A whole batch is decoded before application. Sequence tests exercise uint32 rollover. Server tests distinguish received inputs from inputs actually consumed by a simulation tick, including STOP and discrete actions.

Client tests verify wall/corner replay, bounded prediction history, delayed actor interpolation and continuous projectile presentation through jitter/outage, plus release of departed entities. Frame-rate comparisons cover local fixed-step presentation, projectile trajectories and animation clocks at 30, 60 and 144 FPS. Aim regressions exercise a scaled canvas, smoothed camera, held fire and shots near thin walls. DOM/socket/renderer doubles exercise ownership and callback disposal; they do not prove that a GPU draws the expected pixels.

Performance tests cover bounded batched populations, cancellation/reset, world-wide chunk activity, invulnerability isolation, real authenticated namespace admission, logout/revocation, application restart and production opt-in. Panel tests distinguish server population from client-known/visible objects and preserve connection errors after late updates. Use the interactive [performance world](performance.md) for local measurements.

## Real HTTP and Socket.IO

The transport fixture opens real polling and WebSocket connections using the production MessagePack parser. It supplies authentication at the socket boundary, explicitly chooses v1, steps simulation without background game loops and closes the client, game server, socket server and HTTP connections.

Application tests run on loopback ephemeral ports and use actual session middleware. They check session-ID regeneration, guest login without MongoDB, authenticated socket admission, logout disconnection, rejected reconnect with a revoked cookie, malformed forms and Origin rejection. Repeated/concurrent start/stop and startup failure must leave no listening server or owned game timers.

Mixed-version transport fixtures also connect a v2 client with a v1 observer through each transport. They check tick-consumed acknowledgements, STOP and state delivery without changing v1 negotiation. Controlled fixtures exercise the wider v2 queue/interest cases. Large deployment matrices and long reconnect/soak scenarios remain separate operating evidence.

## Mongo persistence

Local tests skip the real persistence contract unless `TEST_MONGODB_URI` points at a test database. In PowerShell:

```powershell
$env:TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/nodemmo_test"
npm run build
npm test
```

The test creates unique user/session identifiers and cleans up only those records. It verifies that legacy authentication persists a hash and removes plaintext, the hash still works after reconnect, sessions survive store reconnect, expired sessions are rejected immediately and a late touch cannot resurrect a destroyed session. It does not drop the database. Use a dedicated test database because creating the user/session indexes is part of adapter initialization.

CI provides a health-checked MongoDB 8.0 service and always sets `TEST_MONGODB_URI`, so this contract runs there rather than being skipped. Mongo is not required for the ordinary guest development path.

## Browser and renderer verification

After building, run `npm start`, open <http://127.0.0.1:3000> and select **Play as guest**. Check that:

1. `/game` loads the generated `/build/game.js`; assets load and the console has no initialization errors.
2. The WebGL canvas has a 1024 by 576 drawing buffer and shows terrain, player sprite, name and health bar.
3. Ping, FPS and object counts update; WASD, diagonal direction changes and idle animation work.
4. Moving the mouse changes the camera smoothly; typing in chat does not move the player.
5. Two tabs/guest sessions show each other moving; leaving and returning to interest removes and recreates the remote entity correctly.
6. Chat displays sender/content as text; **Log out** returns to login and ends realtime traffic for that session.
7. A lost connection stops input/RAF/heartbeat work and the page can be reloaded into a fresh session without duplicate listeners or resource errors.

Repeat the smoke through the intended development proxy. HTTP success alone is insufficient; a rendered player and live ping also check the proxied socket connection. Secure production cookies require HTTPS and the intended trust-proxy setting.

For renderer changes, compare a deterministic scene in the same browser version, OS, viewport and zoom. Include terrain edges/seams, a centered sprite, rotation/scale, name/health overlays, all movement directions, later animation frames and viewport-edge visibility. Keep expected, actual and diff images when output changes. Classify intentional changes separately from platform rasterization noise and regressions.

`npm run test:browser` runs the real-renderer fixture through Playwright with the lockfile-selected Chromium, SwiftShader and a fixed viewport. Its fixed world contains terrain, walls, a named player with partial health, a damaged enemy and a projectile. The renderer advances exactly twenty frames of animation time per mount; Pixi's shared ticker stays stopped. The fixture checks pixel color/opacity metrics, captures the canvas, disposes/remounts the renderer and compares PNG bytes within that browser run. It also rejects page errors and keeps both images, metrics and failure traces under `test-results/browser/`.

The refactor's manual browser check verified guest login, terrain/player/name/health rendering, live ping/FPS, movement/collision, idle animation, chat input isolation and logout. Its deterministic fixture also rendered matching canvas captures before and after remount. This manual run is separate from the Playwright CLI gate configured in CI.

This is a deterministic rendering/lifecycle regression, not a persisted golden image comparison across commits or platforms. A versioned expected-image baseline and automated full-game/proxy gameplay smoke remain future extensions. Reference: [PixiJS renderer documentation](https://pixijs.com/8.x/guides/components/renderers) and [its visual test harness](https://github.com/pixijs/pixijs/blob/dev/tests/visual/tester.ts).

## CI and operating evidence

`.github/workflows/ci.yml` installs exactly the lockfile, runs strict source checks, import-boundary and formatting gates, builds both artifacts, runs the full test suite with MongoDB and checks high-severity dependency advisories. It installs the pinned Chromium plus Linux browser dependencies, runs the renderer fixture and always attempts to upload its images, metrics and failure traces. Dependency audit results are time-sensitive and are rechecked on each run.

Coverage percentages, production load/soak behavior and GPU visual equivalence are separate measurements. Before claiming capacity, capture tick duration/backlog, event-loop lag, serialization bytes/time, per-client interest size, memory after repeated sessions and client frame time at representative concurrency. Use these measurements to justify future collision-engine, replication or rendering optimizations.
