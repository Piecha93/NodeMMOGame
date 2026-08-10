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

`npm run build` compiles the server and creates the browser client from `client/Launcher.ts` in `dist/public/game.js`. The application serves that generated module at `/build/game.js`, so a clean checkout does not depend on a prebuilt client bundle.

Historical `fire`/`spawner` chat commands and debug weapon actions are disabled by default. Set `ENABLE_DEBUG_COMMANDS=true` only in a trusted development environment when those diagnostics are needed.

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
- The browser pipeline is reproducible, but rendering still uses the checked-in PixiJS 4 compatibility build. Migrate PixiJS separately, with visual regression coverage, instead of combining renderer changes with the bundler migration.
