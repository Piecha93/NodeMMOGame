# Node MMO Game

Engineering thesis project: a multiplayer browser game built with TypeScript, Node.js, Socket.IO, HTML5 and PixiJS.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- MongoDB only when registered-user login is needed

Guest login works without a database.

## Install and run

```sh
npm ci
npm run check
npm run build
npm start
```

Open <http://127.0.0.1:3000> and select **Play as guest**.

The server listens on `127.0.0.1:3000` by default. Override it with the `HOST` and `PORT` environment variables. Set `SESSION_SECRET` to a persistent random value for a long-running deployment.

## Database

Set `MONGODB_URI` to enable registered-user login:

```sh
MONGODB_URI=mongodb://127.0.0.1:27017/node-mmo-game npm start
```

The historical user schema stores passwords as plain text. Do not enable registered accounts in a public or production deployment until password hashing and a migration have been implemented.

## Known modernization boundaries

- `detect-collisions` is intentionally pinned to 2.7.0. Current major versions expose a substantially different API, so that upgrade belongs with collision-behaviour tests and the planned physics refactor.
- The browser client still uses the checked-in PixiJS 4 build and legacy bundle in `public/`. Replacing PixiJS and introducing a current client bundler should be handled together in the larger client refactor.
