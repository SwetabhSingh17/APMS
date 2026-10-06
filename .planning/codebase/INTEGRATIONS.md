---
last_mapped_commit: a672e1e53b1e5280fad2d5fdeb2795de95133954
last_mapped_at: 2026-10-06
---
# External Integrations

**Analysis Date:** 2026-10-06

## APIs & External Services

**Third-Party APIs:**
- Not applicable / None - The application is designed as a self-contained intranet/campus academic management platform. No external third-party cloud APIs (such as Stripe, AWS SDK, SendGrid, or Google OAuth) are actively wired into the core workflow.

**Spreadsheet Ingestion & Export Engine:**
- Excel / Google Forms Responses Ingestion:
  - Client / Server Processing: `exceljs`, `xlsx`
  - Ingests institutional `.xlsx` and `.xls` files for student cohorts (`server/services/onboarding-parser.ts`), supervisor staff directory (`server/services/supervisor-onboarding-parser.ts`), and faculty project topic proposal spreadsheets (`server/services/topic-onboarding-parser.ts`).
  - Exports downloadable demo formats and system backup archives (`archiver`, `jszip`).

## Data Storage

**Databases:**
- PostgreSQL (Self-hosted / LAN instance or Neon Serverless / Vercel Postgres compatible):
  - Primary connection: Environment variable `DATABASE_URL` (format: `postgres://user:password@host:port/database`)
  - Secondary fallback variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - Runtime ORM client: `drizzle-orm/postgres-js` with driver `postgres` (`server/db.ts`)
  - Session connection pool: `pg.Pool` dedicated to `connect-pg-simple` session storage (`server/db.ts`, `server/auth.ts`)
  - Schema definition: `shared/schema.ts`
  - Schema migration & verification tool: Drizzle Kit (`npm run db:push`, `npm run db:ensure`)

**File Storage:**
- Local filesystem & In-memory buffers only:
  - Excel files uploaded during bulk onboarding are received in memory via Multer (`multer.memoryStorage()`) and parsed directly in RAM without writing temporary files to disk.
  - Database schema and data backups are stored locally in `database/backups/`.
  - Static media (department logos, user avatar placeholders) are served from `client/public/` and `dist/public/`.

**Caching:**
- Client-Side Query Cache: TanStack React Query (`client/src/lib/queryClient.ts`) with default 5-second `staleTime` and selective cache invalidation.
- Session Storage: `connect-pg-simple` persists sessions in PostgreSQL table `session` (`sessions`). In-memory session store (`memorystore`) is present as fallback.
- External Cache: No external caching servers (e.g. Redis or Memcached) are required.

## Authentication & Identity

**Auth Provider:**
- Custom Session-Based Authentication:
  - Framework: Passport.js (`passport-local`) integrated with `express-session` (`server/auth.ts`).
  - Password Hashing: Node.js standard library `crypto.scrypt` with a cryptographically secure 16-byte random salt (`hashPassword`, `comparePasswords` in `server/auth.ts`). Automatic migration transparently converts legacy plaintext passwords to scrypt hashes upon successful login.
  - Security Enforcements: First-login mandatory password change via `forcePasswordReset` flag; rate limiting on authentication routes (1000 requests per 15 min per IP via `express-rate-limit`); session cookie signing with `SESSION_SECRET`.

## Monitoring & Observability

**Error Tracking:**
- Application-level error handling via React Error Boundaries (`client/src/components/ErrorBoundary.tsx`) for uncaught frontend exceptions.
- API error responses standardized via custom `ApiError` class (`client/src/lib/queryClient.ts`) and structured status codes in server endpoints (`server/routes/`).

**Logs:**
- Custom Express request logging middleware in `server/index.ts` capturing HTTP method, path, response status, execution duration, and JSON response payloads for all `/api` endpoints.
- Server startup diagnostics logging database connectivity and table schema verification in `server/db.ts`.

## CI/CD & Deployment

**Hosting:**
- On-premise institutional server or cloud VM (Linux / macOS / Windows Server).
- Windows Server deployment automated via `start_server.bat` (automated dependency check, firewall rule provisioning for TCP Port 3000, Vite building, and production launch).
- Unix / macOS deployment via `start-network.sh` and npm scripts.

**CI Pipeline:**
- Local regression and verification test suite: `npm test` runs TypeScript type checks (`tsc`) followed by sequential execution of integration verification test scripts in `scripts/`:
  - `scripts/verify_onboarding_and_access_control.ts`
  - `scripts/verify_supervisor_onboarding_and_rbac.ts`
  - `scripts/verify_bulk_topic_onboarding.ts`
  - `scripts/verify_topic_selection_and_routing.ts`
  - `scripts/verify_priority_bug_fixes.ts`
  - `scripts/verify_password_reset_and_login.ts`
  - `scripts/verify_team_management_and_supervisor_fix.ts`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - Canonical PostgreSQL connection URI (e.g., `postgres://postgres:password@127.0.0.1:5432/integral_project_hub`).
- `SESSION_SECRET` - Cryptographic string used by Express session for cookie HMAC signing.

**Optional env vars:**
- `PORT` - Port to listen on (defaults to 3000 in production, 5000 in dev).
- `NODE_ENV` - Runtime mode (`development` or `production`).
- `ENABLE_HSTS` - Boolean flag to toggle HTTP Strict Transport Security (HSTS) headers.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Fallback database connection credentials when `DATABASE_URL` is omitted.

**Secrets location:**
- Stored exclusively in local root `.env` file (excluded from version control via `.gitignore`).

## Webhooks & Callbacks

**Incoming:**
- Server-Sent Events (SSE): Streaming real-time progress events from `/api/admin/bulk-onboarding` and `/api/admin/bulk-onboarding-supervisors` to update the frontend progress bar during large cohort onboarding.
- WebSockets: `/ws` endpoint for bidirectional instant notifications, authenticated server-side using signed session cookies.

**Outgoing:**
- WebSocket Broadcasts: Real-time event notifications emitted to connected user sockets upon topic approvals, supervisor reassignments, group membership changes, and password resets (`server/websocket.ts`).

---

*Integration audit: 2026-10-06*
