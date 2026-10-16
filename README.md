# Node MMO Game

Multiplayer browser game built with TypeScript, Node.js, Socket.IO and PixiJS. The server owns game state; the client predicts local movement and renders remote snapshots.

The current expedition is a gameplay prototype for 1–4 players: recover three cores from guarded ruins and return to camp. The next direction is still open; current work focuses on responsive movement, shooting and a small, readable game loop. WASD moves, the mouse aims and holding the left button fires. [Prototype rules](docs/gameplay.md).

For engine experiments, choose **Poligon / test wydajności** at the entrance or in the game header. Its separate world supports up to 2000 enemies, different workloads and live client/server measurements. [Performance test controls and metric definitions](docs/performance.md).

## Requirements

- Node.js 24 LTS, selected by `.nvmrc`.
- npm 10 or newer; install the committed lockfile with `npm ci`.
- MongoDB for registered accounts or persistent sessions. Guest development works without a database.

The project uses TypeScript 7.0.2, strict checking and checked indexed access. The server, browser and shared modules have separate compiler boundaries.

## Install and run

```sh
npm ci
npm run check
npm run check:boundaries
npm run format:check
npm run build
npm test
npm start
```

Open <http://127.0.0.1:3000> and select **Wyrusz jako gość**. WASD moves the player; Enter focuses chat. Use **Opuść wyprawę** to end the HTTP session and disconnect its realtime connections.

`HOST` and `PORT` select the listen address; defaults are `127.0.0.1:3000`. `DEMO_SCENARIO=expedition` is the default playable scenario; `walls` selects the historical wall scene, and `none` starts an empty world. Debug gameplay commands remain disabled unless `ENABLE_DEBUG_COMMANDS=true` is set for trusted development.

`npm run build` creates the server under `dist/` and the browser bundle at `dist/public/game.js`. The game page loads that generated module at `/build/game.js`. PixiJS comes from npm; no checked-in renderer global or stale browser bundle is required.

## Architecture

- `shared/core/` supplies world context, movement and replication bookkeeping. Each world owns its configuration, clock, random source, registry and prefab catalog. `GameCore.step()` advances one fixed simulation tick; `advance()` and the application scheduler handle elapsed real time.
- `shared/protocol/` owns validated DTOs and the v2/v3 binary codecs. Stable field IDs, explicit framing, UTF-8 and bounded batches are independent of class/decorator order.
- `shared/replication/` translates domain state and maintains each client's visibility baseline. Create, update and destroy records describe entering, changing and leaving interest.
- `shared/serialize/` is the compatibility boundary for legacy v1 and chunk snapshots. Its metadata and byte fixtures remain separate from domain replication state.
- `server/` owns HTTP, authentication, persistence, transport, client sessions and scheduling. `createApplication()` exposes explicit start/stop instead of starting on import.
- `client/` owns input capture, prediction/replay, remote interpolation, rendering, UI and resource lifecycle.

The code remains a single repository with explicit import rules. It does not require an ECS or a transport rewrite.

## Network compatibility

New clients offer `[3, 2, 1]`; the server chooses the highest common version. Missing negotiation fields still mean legacy v1. Application event codes remain frozen at their original values.

The new expedition uses the appended marker prefab `I` and requires v2 or newer. Sandbox modes retain v1 admission and the historical A–H prefab mappings.

V2/v3 snapshots identify the server tick, snapshot and last processed input sequence. V3 uses compact field masks, variable-length integers and float32 for remote state; authoritative local-player state keeps float64 precision. Its interest area follows the camera with prefetch and exit hysteresis, while older clients keep their original formats and chunk interest.

Local prediction replays only unacknowledged commands through shared movement/collision code. Remote actors use a bounded interpolation history with a 100 ms delay. Straight projectiles start moving from their first sample and extrapolate at most 80 ms past the latest authoritative sample before holding; server collision/destruction remains authoritative.

V1 remains a rolling-upgrade fallback with its original record bytes and legacy string encoding. UTF-8 is a v2 feature. Existing v1 byte fixtures continue to guard compatibility.

## Accounts and sessions

Set `MONGODB_URI` to enable registered accounts. Passwords use salted scrypt hashes; a correct legacy login atomically stores a hash and removes the old plaintext field. Dormant legacy accounts still need migration or reset.

Development sessions default to MemoryStore. Production requires a stable `SESSION_SECRET`, secure cookies and a persistent session store; built-in Mongo storage is selected with `SESSION_STORE=mongo`. Only set `TRUST_PROXY=true` behind the intended trusted reverse proxy. See [Authentication and lifecycle](docs/authentication.md) for configuration, migration and logout behavior.

## Verification and remaining work

CI checks strict TypeScript, import boundaries, formatting, generated artifacts, unit/real Socket.IO tests, Mongo persistence, a deterministic Chromium renderer fixture and dependency advisories. The Mongo integration test is optional locally through `TEST_MONGODB_URI` and runs against MongoDB 8.0 in CI. Browser checks compare a nonblank scene before and after renderer remount in the same pinned browser run and retain images/metrics.

The project still needs production load measurements, operational monitoring and a versioned golden-image visual baseline across changes. `detect-collisions` stays pinned to 2.7.0 until a separate engine upgrade is characterized. See [Testing](docs/testing.md) and [Known issues](docs/known-issues.md) for the limits of the current checks.

- [Architecture](docs/architecture.md)
- [Testing and CI](docs/testing.md)
- [Authentication and lifecycle](docs/authentication.md)
- [Known issues](docs/known-issues.md)
