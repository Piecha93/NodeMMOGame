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
- instance registries own separate maps and generated-ID sequences, reject duplicate or prefab-mismatched IDs, roll back failed creates and complete destroy cleanup even when listeners fail;
- two `GameCore` instances can both own `C0` in separate maps and chunks; destroying or disposing one core leaves the other core and its next ID untouched;
- a destroyed object is removed from its recorded old chunk and its tombstone is attached to exactly that chunk, even if its transform changed before destruction;
- chunk deactivate/reload preserves explicit wire IDs and deserializes each object once through the owning factory;
- server-client lifecycle state and independent rate-limit windows behave deterministically;
- the object spawner stays disabled until debug actions are explicitly enabled;
- readiness is idempotent, malformed pre-ready input is contained, and duplicate-session or timeout cleanup removes client state;
- heartbeat and chat floods are capped, while a missing heartbeat response does not stop later requests;
- database-backed player names are sanitized before they reach the browser chat view;
- a nontrivial `dist/public/game.js` and source map are generated from `client/Launcher.ts`, and `game.ejs` loads that module instead of the historical bundle;
- the source map traces PixiJS to the npm package, `game.ejs` has no renderer-global script, and the checked-in PixiJS 4 file is absent;
- the client asset manifest has unique aliases and valid animation-frame classification without requiring a fake DOM or WebGL implementation in Node.js.

The UTF-8 round-trip test is intentionally skipped. Changing string encoding in isolation would make the current client and server protocol incompatible, so that test becomes an enforced regression test only with protocol v1.

## Manual browser smoke

After a production build, run `npm start`, open <http://127.0.0.1:3000>, and choose **Play as guest**. Verify that:

- `/game` loads `/build/game.js` without a separate PixiJS script, and all image and sprite-sheet requests return successfully;
- the WebGL renderer initializes without console or page errors and the canvas has a 1024 by 576 drawing buffer;
- the canvas renders terrain, the player sprite, player name and red health bar rather than a blank or single-color frame;
- ping, FPS and object counters keep updating without browser-console errors;
- WASD controls the player, diagonal input selects the matching directional animation, and an idle player keeps animating instead of remaining on its first frame;
- moving the mouse changes the camera deviation smoothly, while the player remains centered as the world moves;
- typing WASD in the chat field does not move the player;
- a chat message is displayed as text, and logout returns to the login form.

When the server is exposed through a development proxy such as Tailscale Serve, repeat guest login and initialization through that URL. A successful HTTP response alone is insufficient: the canvas and live ping confirm that the Socket.IO connection also traverses the proxy.

## PixiJS renderer comparison

PixiJS 8.19.0 uses asynchronous renderer and asset initialization, and this application selects its WebGL renderer. For every renderer or asset-loader change, compare the same local scene before and after the change in the same browser, operating system, viewport and zoom level. Capture the canvas only after resource requests have completed and the player is visible.

At minimum compare:

1. terrain tile crop, seams and camera edges;
2. a centered static sprite at its expected width, height, anchor and rotation;
3. the player name and health bar at full and partial health;
4. the first frame of all eight movement directions plus a later frame from one looping animation;
5. visibility transitions near every viewport edge.

Keep expected, actual and diff images when a visual mismatch is found. Do not accept a new image merely because the renderer version changed: classify changes as intentional, platform rasterization noise or a regression first. This follows the PixiJS project's own visual-test shape—deterministic scenes, a real renderer, PNG snapshots, a bounded pixel diff and combined expected/actual/diff failure output—without adding a heavyweight browser harness before this project has a deterministic scene fixture.

The Node.js suite deliberately does not instantiate a mocked renderer. It is appropriate for asset aliases, sprite-sheet frame grouping, direction selection, culling math and build integration. Successful WebGL context creation, texture upload, text rasterization, compositing, animation timing and the final pixels require the browser gate above.

Reference material:

- [PixiJS v8 migration guide](https://pixijs.com/8.x/guides/migrations/v8)
- [PixiJS renderer guide](https://pixijs.com/8.x/guides/components/renderers)
- [PixiJS asset guide](https://pixijs.com/8.x/guides/components/assets)
- [PixiJS project's visual snapshot harness](https://github.com/pixijs/pixijs/blob/dev/tests/visual/tester.ts)

## Next tests

Before moving domain code, add characterization tests for:

1. repeat the lifecycle scenarios through real Socket.IO client/server transports rather than socket doubles;
2. registry and core disposal across many reconnecting client sessions;
3. collision enter and stay behavior in addition to the exit regression;
4. object movement between chunks and per-client visibility;
5. complete and delta serialization using golden binary fixtures;
6. fuzz/property coverage for every accepted transport payload;
7. two-client state synchronization and automation of the manual browser guest-login smoke test;
8. a deterministic PixiJS scene fixture with pinned Chromium screenshots and reviewable pixel-diff artifacts;
9. injected configuration and prefab catalogs so differently configured worlds can be tested without mutating `SharedConfig` or process-wide prefab state.

Each bug fix should begin with a failing reproduction. A refactor is complete only when existing tests remain green and the changed behavior has a focused regression test.

## CI

`.github/workflows/ci.yml` runs on pushes and pull requests with Node.js 22. It installs exactly `package-lock.json`, checks TypeScript, builds both server and browser artifacts, runs tests against those fresh artifacts and rejects high-severity dependency advisories.

CI does not yet enforce coverage, formatting, linting, load tests or strict TypeScript. Add those incrementally after their initial baselines are measured; do not hide existing failures with blanket ignores.
