# Authentication and application lifecycle

`app.ts` is a thin executable entrypoint. Importing it does not start HTTP, timers, workers or MongoDB. `createApplication()` composes the HTTP app, Socket.IO, game runtime, user repository and session store. `start()` and `stop()` are idempotent and concurrent calls share the same operation. A later start creates a fresh HTTP/socket/game runtime. When performance tests are enabled, startup awaits its worker before accepting HTTP connections. Stop disconnects clients, removes game timers and listeners, disposes the worlds, joins or terminates the owned worker and closes persistence connections. SIGINT and SIGTERM use that same shutdown path.

`GameServer` starts with an empty world unless a scenario is supplied. The application defaults to the cooperative expedition. Select the historical 1000-wall demo with `DEMO_SCENARIO=walls`, or `none` for an empty world and deterministic test fixtures. The expedition owns authored ruins and its population controller; sandbox scenarios use their core's dimensions and random source.

## Configuration

| Variable | Development default | Meaning |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | HTTP listen address. |
| `PORT` | `3000` | Listen port; `0` requests an ephemeral test port. |
| `SESSION_SECRET` | Random per application | Persistent signing secret; production requires at least 32 bytes. |
| `SESSION_STORE` | `memory` | `mongo` for built-in persistence; `external` requires an injected store. Production defaults to Mongo and rejects MemoryStore. |
| `MONGODB_URI` | Unset | Enables registered accounts and supplies the Mongo session store when selected. Guests work without Mongo. |
| `SESSION_COOKIE_SECURE` | `false` | Production defaults to and requires `true`; use HTTPS. |
| `TRUST_PROXY` | `false` | Set `true` only behind one trusted reverse proxy; Express then trusts one hop for secure cookies and client IP. |
| `DEMO_SCENARIO` | `expedition` | `expedition`, `walls` or `none`. |

Session cookies are HttpOnly, SameSite=Lax and expire after 24 hours. The Mongo store uses a TTL index and also checks expiry when reading, without relying on the TTL worker's cleanup timing. Touch does not upsert, so a late polling response cannot recreate a deleted session. An externally injected store must provide equivalent expiry/deletion semantics and may expose `connect()`/`close()` lifecycle hooks.

Mongo availability follows connection/disconnection events. A temporary operation error does not permanently disable session middleware; a reconnect or application restart announces readiness again. While session storage is unavailable, HTTP routes return a retryable 503 response and new authenticated socket admission fails closed.

Login accepts bounded string credentials through a 4 KiB form body, rejects duplicate/object-valued fields and caps attempts at ten per minute per client IP. The in-process limiter is bounded and belongs to the application; horizontal deployments need a shared limit at their ingress. Browser login/logout requests with a different Origin are rejected. Socket.IO admits only authenticated sessions and revalidates the store at namespace admission.

Successful login regenerates the session identifier and saves it before redirecting. Logout is `POST /logout`; the game page supplies its form. It destroys the server-side session, expires the cookie and disconnects every socket in that session's room. `GET /logout` returns 405. A revoked cookie cannot authenticate a new socket.

## Password migration

Passwords use the asynchronous Node.js `crypto.scrypt` implementation with a random 16-byte salt and a 64-byte derived key. The versioned stored format includes its parameters: `scrypt$1$16384$8$5$<salt-base64url>$<key-base64url>`. This is OWASP's 16 MiB profile, with N=2^14, r=8 and p=5. Verification accepts only the known bounded profile and uses `timingSafeEqual`; unknown accounts also incur password verification work. Passwords are compared as supplied, including Unicode and whitespace.

Historical documents containing `password` remain readable only for migration. After a correct legacy login, an atomic compare-and-set writes `passwordHash` and removes `password` before authentication succeeds. Failed verification leaves the record untouched. A failed write does not authenticate against stale plaintext; a concurrent migration is accepted only after verifying the newly persisted hash. No API or session response includes password material.

Back up the database before deploying the schema migration, then track remaining documents with a `password` field. Accounts that never log in still retain their historical plaintext until migrated or reset; a password-reset campaign or an offline migration is needed to eliminate dormant legacy records. The application has no registration or password-reset UI yet. The exported `hashPassword()` function is the single format implementation for future account-management flows.

References: [Node.js scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt), [Express session lifecycle](https://expressjs.com/en/resources/middleware/session/).

## Verification

The application tests use real HTTP and Socket.IO on loopback ephemeral ports. They cover session rotation, guest login without a database, logout and rejected reconnect, malformed credentials, Origin checks, repeated start/stop and startup rollback. Password tests cover Unicode, salt uniqueness, malformed hash profiles and legacy migration.

Set `TEST_MONGODB_URI` to a disposable test database to enable the real persistence contract. It verifies migration after reconnect, removal of plaintext, session persistence, immediate expiry and no resurrection after destroy/touch. It creates unique test user/session identifiers and removes only those records. No external database is contacted when that variable is absent.
