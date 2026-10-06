---
last_mapped_commit: a672e1e53b1e5280fad2d5fdeb2795de95133954
last_mapped_at: 2026-10-06
---
# Codebase Concerns

**Analysis Date:** 2026-10-06

## Tech Debt

**Business Logic in Express Route Handlers:**
- Issue: Route handlers in `server/routes/admin.ts`, `server/routes/groups.ts`, `server/routes/projects.ts`, and `server/routes/topics.ts` contain extensive inline business logic, validation, and multi-step DB orchestration rather than delegating to dedicated controller or service modules.
- Files: `server/routes/admin.ts`, `server/routes/groups.ts`, `server/routes/projects.ts`, `server/routes/topics.ts`
- Impact: Decreases modularity, complicates unit testing without full HTTP mocking, and duplicates validation logic across endpoints.
- Fix approach: Extract business workflows into domain service classes (e.g. `ProjectService`, `GroupService`, `TopicService`) and keep route handlers focused on HTTP request/response mapping.

**Backup Export/Restore Relational Incompleteness & FK Insertion Order:**
- Issue: `exportData()` in `server/db-storage.ts` archives only users, groups, members, topics, and projects, leaving out `project_assessments`, `project_milestones`, and `notifications`. During `importData()`, inserting `users` before `student_groups` can cause FK violations when users reference `groupId`.
- Files: `server/db-storage.ts:1680-1780`
- Impact: System backups miss assessment grading history; restore operations can fail or silently skip user-to-group relationships.
- Fix approach: Include all tables in `exportData()`; enforce strict topological insertion order during restore (groups → users → members → topics → projects → assessments → milestones).

**Mock Activity Feed in Stats Route:**
- Issue: `GET /api/activities` in `server/routes/stats.ts` returns a static hardcoded array rather than dynamic system events.
- Files: `server/routes/stats.ts:68-110`
- Impact: Administrators and Coordinators see mock placeholder activities on the dashboard rather than live audit events.
- Fix approach: Query real recent records (recent topic approvals, team formations, password resets) or implement an `audit_logs` table.

**Redundant HTTP Server Construction:**
- Issue: `registerRoutes()` in `server/routes/index.ts` creates an `http.Server` via `createServer(app)` that is immediately ignored and re-created in `server/index.ts`.
- Files: `server/routes/index.ts:28-29`, `server/index.ts:145`
- Impact: Code confusion and dead server instances.
- Fix approach: Remove `createServer(app)` from `registerRoutes()` and let `server/index.ts` handle HTTP server instantiation exclusively.

**Notification Preferences Endpoint Stub:**
- Issue: `PATCH /api/user/notifications` returns `{ success: true }` without updating any database column.
- Files: `server/routes/users.ts:41-48`
- Impact: User notification preference changes are not persisted.
- Fix approach: Add `notification_preferences` column to `users` table or remove the setting until implemented.

## Known Bugs

**Client-Only Registration Gate:**
- Symptoms: The "Registrations are closed" overlay in `client/src/pages/auth-page.tsx` is enforced exclusively in the frontend UI.
- Files: `client/src/pages/auth-page.tsx:14-25`, `server/routes/auth.ts`
- Trigger: A malicious actor sending a direct `POST /api/register` HTTP payload can bypass the client overlay and create student accounts.
- Workaround: Server enforces single Admin and Coordinator limit, but student registration is not explicitly blocked server-side when `IS_REGISTRATION_OPEN = false`.
- Fix approach: Introduce an environment variable or database setting `REGISTRATION_OPEN` enforced in `POST /api/register` in `server/routes/auth.ts`.

**Misleading Import Success Message:**
- Symptoms: After an admin imports a database backup in `client/src/pages/system-management.tsx`, the UI shows a toast message saying "Please log in again" and force-redirects to `/auth`, even though the backend preserves the importing admin's active session.
- Files: `client/src/pages/system-management.tsx:210-225`
- Trigger: Completing database restore.
- Workaround: Admin can simply log in again.
- Fix approach: Update toast copy to confirm restore without forcing redirection.

## Security Considerations

**Server-Side Input Sanitization for User Text Fields:**
- Risk: While React automatically escapes values in the DOM, user-submitted strings (topic titles, descriptions, feedback) are stored directly in PostgreSQL without HTML sanitization. If any future view renders content using `dangerouslySetInnerHTML` or exports to unescaped formats, stored XSS could occur.
- Files: `server/routes/topics.ts`, `server/routes/groups.ts`
- Current mitigation: React DOM text escaping and Zod schema validation.
- Recommendations: Integrate `sanitize-html` or `DOMPurify` to clean text fields before database insertion.

**Default Session Secret Fallback:**
- Risk: In `server/auth.ts` and `server/websocket.ts`, `SESSION_SECRET` falls back to a hardcoded string (`"integral-university-project-portal-secret"`) if the environment variable is not provided in `.env`.
- Files: `server/auth.ts:135`, `server/websocket.ts:67`
- Current mitigation: Development convenience fallback.
- Recommendations: Enforce strict fail-fast startup validation in production requiring a non-empty, high-entropy `SESSION_SECRET`.

**Granular Rate Limiting:**
- Risk: IP rate limiting (`authLimiter`) is present on `/api/login` and `/api/register`, but heavy operations like Excel bulk onboarding (`/api/admin/bulk-onboarding`) and full database export (`/api/admin/export-data`) lack separate rate limits.
- Files: `server/routes/admin.ts`
- Current mitigation: Authentication and role checking required (`requireRole`).
- Recommendations: Add dedicated rate limiters for expensive bulk file operations.

## Performance Bottlenecks

**In-Memory Excel Processing:**
- Problem: Large Excel workbooks uploaded during cohort onboarding are parsed entirely in Node.js RAM via `multer.memoryStorage()`.
- Files: `server/routes/admin.ts:12`, `server/services/onboarding-parser.ts`
- Cause: Holding large multi-megabyte binary workbooks and converting sheets to JS object arrays strains garbage collection.
- Improvement path: Stream workbooks or enforce maximum file size limits (currently set to 25MB) with worker threads for parsing if cohorts grow beyond 5,000 students.

**Unbounded User & Group Queries:**
- Problem: `getAllUsers()` and `getAllStudentGroups()` return full table results when pagination parameters are not supplied or `limit=all` is requested.
- Files: `server/db-storage.ts`, `server/routes/admin.ts:18-35`
- Cause: Intended for fast client-side filtering on current cohort sizes (~700 students).
- Improvement path: Enforce virtualized infinite queries with cursor or page-based limits as the student directory expands.

## Fragile Areas

**Dual Database Connection Pools:**
- Files: `server/db.ts`
- Why fragile: The app maintains two separate database connections: a `postgres` driver instance for Drizzle ORM queries and a `pg.Pool` instance for Express session storage (`connect-pg-simple`).
- Safe modification: Ensure both clients share identical connection timeouts (`connectionTimeoutMillis: 5000`) and handle connection drops gracefully.
- Test coverage: Validated in `scripts/ensure_db.ts`.

**Excel Sheet Header Matching:**
- Files: `server/services/onboarding-parser.ts`, `server/services/supervisor-onboarding-parser.ts`, `server/services/topic-onboarding-parser.ts`
- Why fragile: Parsers depend on exact column header strings from institutional templates (e.g. "Project Team Id", "Enrollment Number", "Employee ID"). Small typographic differences in uploaded faculty sheets can cause columns to be skipped.
- Safe modification: Use fuzzy/normalized case-insensitive header mapping.
- Test coverage: Covered by `scripts/verify_bulk_topic_onboarding.ts` and `scripts/verify_supervisor_onboarding_and_rbac.ts`.

## Scaling Limits

**WebSocket Multi-Instance Broadcasting:**
- Current capacity: Single-node in-memory `Map<number, Set<WebSocket>>` in `server/websocket.ts`.
- Limit: Does not synchronize across multiple Node processes or horizontal container replicas.
- Scaling path: Introduce Redis pub/sub adapter to broadcast WebSocket events across clustered application instances.

**5-Team Mentorship Cap:**
- Current capacity: Institutional policy limits faculty supervisors to 5 allotted student teams.
- Limit: Managed in application logic across `server/routes/groups.ts` and `server/routes/projects.ts`.
- Scaling path: Ensure atomic transaction locks or database constraints prevent race conditions during high-concurrency topic selection periods.

## Dependencies at Risk

**`@types/express-rate-limit` (v5.1.3 vs `express-rate-limit` v8.6.1):**
- Risk: Type definitions in devDependencies are for legacy v5 while the runtime package is v8.
- Impact: Potential typing mismatches if rate limiting options are refactored.
- Migration plan: Upgrade `@types/express-rate-limit` or remove if v8 provides built-in typings.

## Missing Critical Features

**Transactional Email Dispatch:**
- Problem: The portal relies entirely on in-app notifications and WebSockets; no SMTP or transactional email delivery (e.g., SendGrid, Nodemailer) is wired up.
- Blocks: Students and faculty who are offline do not receive email alerts for team invitations, supervisor allocations, or password resets.

**Automated Audit Log Table:**
- Problem: Critical administrative events (bulk cohort imports, default password resets, team dissolutions) are not recorded in a persistent database audit trail.
- Blocks: Historical accountability for administrative interventions.

## Test Coverage Gaps

**Frontend Unit & Integration Tests:**
- What's not tested: React components, form validation interactions, modal states, and custom hooks have no automated unit tests.
- Files: `client/src/components/`, `client/src/pages/`, `client/src/hooks/`
- Risk: Regressions in complex forms (like team creation and supervisor management modals) can only be caught through manual UI testing.
- Improvement path: Configure Vitest and React Testing Library for component testing.

**Browser End-to-End Tests:**
- What's not tested: Full browser flows (login → modal interactions → WebSocket toasts → page transitions) are not covered by automated browser runners like Cypress or Playwright.
- Files: `client/src/`
- Risk: Frontend routing or CSS layout regressions on different viewports require manual QA.

---

*Concerns analysis: 2026-10-06*
