# Node MMO Game

Engineering thesis project: a multiplayer browser game built with TypeScript, Node.js, Socket.IO, HTML5 and PixiJS.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- MongoDB only when registered-user login is needed

Guest login works without a database.

## Install and run

```sh
npm ci
npm run check
npm run build
npm test
npm start
```

Open <http://127.0.0.1:3000> and select **Play as guest**.

The server listens on `127.0.0.1:3000` by default. Override it with the `HOST` and `PORT` environment variables. Set `SESSION_SECRET` to a persistent random value for a long-running deployment.

`npm run build` compiles the server and creates the browser client from `client/Launcher.ts` in `dist/public/game.js`. The bundle includes PixiJS 8.19.0 from npm, and the application serves it at `/build/game.js`, so a clean checkout does not depend on checked-in browser libraries or a prebuilt client bundle.

Historical `fire`/`spawner` chat commands and debug weapon actions are disabled by default. Set `ENABLE_DEBUG_COMMANDS=true` only in a trusted development environment when those diagnostics are needed.

## Runtime ownership

Each `GameCore` owns one `GameObjectsManager` and one `GameObjectsFactory`. Object maps, generated-ID sequences and create/destroy subscriptions therefore belong to a world instance rather than to process-wide static state. Server, browser renderer, input handling, chunking and serialization use the manager or factory supplied by their owning core.

The factory validates and constructs an object, attaches it to its owning runtime and registers it with the manager. The core then adds it to its chunk and collision world and marks it for a complete update. Destruction removes the same object from the registry, its owned chunk and collision world and, on the server, records the network tombstone against that old chunk. `GameCore.dispose()` destroys remaining objects and removes subscriptions; it is safe to call more than once.

The legacy wire prefixes remain deliberately stable: `A` DefaultPlayer, `B` Michau, `C` Wall, `D` HpPotion, `E` Doors, `F` FireBall, `G` Portal and `H` PlatformTriggerTest. The prefab catalog and `SharedConfig` are still process-wide, and the protocol is still unversioned; those are explicit boundaries for the next refactor stages.

## Database

Set `MONGODB_URI` to enable registered-user login:

```sh
MONGODB_URI=mongodb://127.0.0.1:27017/node-mmo-game npm start
```

The historical user schema stores passwords as plain text. Do not enable registered accounts in a public or production deployment until password hashing and a migration have been implemented.

## Project documentation

- [Architecture and refactor boundaries](docs/architecture.md)
- [Testing and CI](docs/testing.md)
- [Known issues and first-stage exit criteria](docs/known-issues.md)

CI runs the TypeScript check, application build, Node.js test suite and a high-severity dependency audit. Run the commands from the install section before submitting a change.

## Known modernization boundaries

- `detect-collisions` is intentionally pinned to 2.7.0. Current major versions expose a substantially different API, so that upgrade belongs with collision-behaviour tests and the planned physics refactor.
- Rendering uses PixiJS 8.19.0 with its WebGL renderer. Current PixiJS 8 does not provide a production Canvas fallback, so the browser smoke gate must include renderer initialization and a real rendered frame rather than only HTTP checks.
- The PixiJS API migration is covered by build and pure asset-classification regressions. Pixel output still has a manual comparison gate until a deterministic browser fixture and pinned screenshot environment are added.
- Runtime object state is instance-owned, but `SharedConfig` and the prefab catalog remain global. Do not treat separate cores in one process as independently configurable client/server runtimes until those dependencies are injected.
