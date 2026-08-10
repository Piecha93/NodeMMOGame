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

## Critical before public deployment

- Registered-user passwords use the historical plain-text schema. Registered login must remain disabled outside trusted development until hashes and a migration exist.
- Realtime payload checks are implemented at individual handlers, but there is no complete versioned schema or fuzz/integration suite proving every transport boundary.
- Debug commands are development-gated and rate-limited, but the server still exposes historical debug/gameplay paths that need a deliberate production threat review.
- The project has not been load-tested and has no production monitoring or persistent session store.

The current Tailscale guest deployment is a development preview, not a public production service.

## Correctness and lifecycle

- Global factory callbacks and registries make cleanup, isolated tests and multiple world instances unreliable.
- Disconnect/reconnect, duplicate readiness and heartbeat loss have defensive code plus socket-handler tests, but still need end-to-end coverage with real Socket.IO clients.
- Per-client chunk visibility and movement between neighboring chunks need characterization tests before refactoring.
- Most code compiles without strict null and indexed-access checking; strict diagnostics currently reveal a substantial backlog.

## Build and client

- `npm run build` now creates `dist/public/game.js` from the current `client/Launcher.ts` source, and Express exposes that artifact at `/build/game.js`.
- A build regression checks the artifact, its source map and the browser view, so CI fails if the executable client falls out of sync with current source.
- Rendering still depends on the checked-in PixiJS 4 compatibility script. Its API migration is the next client stage and needs browser smoke plus visual-regression coverage.
- The generated client and server now use matching Socket.IO 4 packages, so Engine.IO 3 compatibility is no longer enabled. The manual guest-login smoke path covers local and proxied Socket.IO initialization; automating it remains open.

## Protocol

- String fields use a one-byte length and one byte per JavaScript code unit. Non-ASCII text is corrupted and strings are effectively limited to 255 code units.
- The wire format has no explicit version, bounds contract or compatibility negotiation.
- Object IDs, property masks and prefab mappings rely on implicit sizes and registration order.

UTF-8 is deliberately not patched in isolation: the generated browser client and server still share the same unversioned legacy wire format. It belongs in a coordinated, versioned protocol migration.

## Quality and documentation gaps

- The foundation suite covers only a small part of the simulation; real Socket.IO, browser, database and load tests remain to be added.
- Linting, formatting, coverage thresholds and a strict-TypeScript ratchet are not yet configured.
- Gameplay controls, protocol details, deployment operations and security procedures still need dedicated documentation.

## First-stage exit criteria

The foundation stage is complete when:

- CI installs, checks, builds, tests and audits from a clean checkout;
- malformed and repeated socket events cannot crash or leak server state;
- every confirmed P0/P1 bug has a regression test;
- the browser bundle is generated from the current client source; **complete and enforced in CI**;
- the documented guest-login smoke path works on a clean machine;
- known protocol incompatibilities have an explicit migration plan.
