# Testing

The project uses the test runner built into Node.js and compiles tests with the same TypeScript version as the application. There is no additional test framework dependency.

## Local quality gate

Run the same checks as CI:

```sh
npm ci
npm run check
npm run build
npm test
npm audit --audit-level=high
```

`npm test` removes `dist-test/`, compiles test files with `tsconfig.test.json`, and runs every compiled `*.test.js` file discovered by `node --test`. Test artifacts never share `dist/` with the runnable application.

The build precedes tests intentionally: the build-level regression reads `dist/public/game.js` and its source map. Run `npm run build` before `npm test` when invoking individual commands; the complete command sequence above and CI already enforce that order.

## Test layout and naming

- `tests/foundation/`: low-level characterization and regression tests introduced with the refactor foundation.
- `tests/build/`: assertions about generated application artifacts and the browser entry used by the server-rendered view.
- `tests/*.test.ts`: focused simulation, input and server-client unit regressions.
- `tests/socket/`: handler-level Socket.IO lifecycle, rate-limit, heartbeat and debug-action regressions using controlled socket doubles.
- Future `tests/browser/`: login, rendering and gameplay smoke tests.
- Test names begin with an area prefix such as `foundation/chunks:` so CI output remains searchable.

## Current coverage

The initial suite verifies:

- a non-square 2 by 3 chunk grid exposes all six chunks and a symmetric neighbor graph;
- the legacy serializer round-trips supported ASCII strings;
- valid input keeps its existing wire format, while malformed, oversized, duplicate, non-finite and out-of-range fields are rejected atomically;
- snapshot handlers ignore stale IDs, register one cleanup listener and remove state when a player is destroyed;
- collision-exit data identifies the pair that stopped colliding, and polygon colliders follow transform rotation;
- invalid prefab names and non-finite spawn positions fail with controlled errors;
- server-client lifecycle state and independent rate-limit windows behave deterministically;
- the object spawner stays disabled until debug actions are explicitly enabled;
- readiness is idempotent, malformed pre-ready input is contained, and duplicate-session or timeout cleanup removes client state;
- heartbeat and chat floods are capped, while a missing heartbeat response does not stop later requests;
- database-backed player names are sanitized before they reach the browser chat view;
- a nontrivial `dist/public/game.js` and source map are generated from `client/Launcher.ts`, and `game.ejs` loads that module instead of the historical bundle;
- the PixiJS 4 script remains explicit until its renderer migration, preventing the build-pipeline change from silently changing rendering behavior.

The UTF-8 round-trip test is intentionally skipped. Changing string encoding in isolation would make the current client and server protocol incompatible, so that test becomes an enforced regression test only with protocol v1.

## Manual browser smoke

After a production build, run `npm start`, open <http://127.0.0.1:3000>, and choose **Play as guest**. Verify that:

- `/game` loads `/javascripts/pixi.min.js` followed by the module at `/build/game.js`;
- the 1024 by 576 canvas renders the map, player and debug counters;
- ping, FPS and object counters keep updating without browser-console errors;
- WASD controls the player, while typing those keys in the chat field does not move it;
- a chat message is displayed as text, and logout returns to the login form.

When the server is exposed through a development proxy such as Tailscale Serve, repeat guest login and initialization through that URL. A successful HTTP response alone is insufficient: the canvas and live ping confirm that the Socket.IO connection also traverses the proxy.

## Next tests

Before moving domain code, add characterization tests for:

1. repeat the lifecycle scenarios through real Socket.IO client/server transports rather than socket doubles;
2. registry cleanup across many reconnecting client sessions;
3. collision enter and stay behavior in addition to the exit regression;
4. object movement between chunks and per-client visibility;
5. complete and delta serialization using golden binary fixtures;
6. fuzz/property coverage for every accepted transport payload;
7. two-client state synchronization and automation of the manual browser guest-login smoke test.

Each bug fix should begin with a failing reproduction. A refactor is complete only when existing tests remain green and the changed behavior has a focused regression test.

## CI

`.github/workflows/ci.yml` runs on pushes and pull requests with Node.js 22. It installs exactly `package-lock.json`, checks TypeScript, builds both server and browser artifacts, runs tests against those fresh artifacts and rejects high-severity dependency advisories.

CI does not yet enforce coverage, formatting, linting, load tests or strict TypeScript. Add those incrementally after their initial baselines are measured; do not hide existing failures with blanket ignores.
