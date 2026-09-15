# Fixes and Improvements Required

This document outlines suggested architectural, security, and maintenance improvements for the APMS project. These fixes are intended to enhance the codebase's scalability, maintainability, and security.

---

## 🚨 Priority Bugs to be Resolved

All items below were verified directly against the current codebase. Fix in this order — the critical ones are actively exploitable on a LAN deployment.

### 🔴 CRITICAL

- [x] **Privilege Escalation via `/auth/register`** — `server/routes/auth.ts` — **FIXED**
  The duplicate registration endpoint performed **no role validation**: any anonymous caller could `POST /auth/register` with `"role": "admin"` and gain full administrator access. The primary `/api/register` route correctly enforces the single-Admin/single-Coordinator rule, but this shadow surface bypassed it entirely.
  *Resolution:* `/auth/register` deleted. All registration now flows through `/api/register` exclusively.

- [x] **Password Hash Exposure via `/auth/login`** — `server/routes/auth.ts` — **FIXED**
  Returned `{ user: req.user }` — the raw database row **including the scrypt password hash**.
  *Resolution:* Response now strips the `password` field. (Kept for dev/test script compatibility; the client uses `/api/login`.)

- [x] **Unauthenticated Supervisor Enumeration with Hashes** — `server/routes/users.ts` — **FIXED**
  `GET /api/supervisors` had no auth guard and returned complete user rows. Anyone on the network — no login required — could enumerate every supervisor's username, email, and password hash.
  *Resolution:* Endpoint now requires authentication (students still have access for team formation) and returns only `{ id, firstName, lastName, email }`.

### 🟠 HIGH

- [x] **Notification Inbox Is Non-Functional End-to-End** — multiple files — **FIXED**
  There was no `GET /api/notifications` endpoint anywhere on the server, yet the WebSocket hook invalidated that exact query key, and both the `/notifications` page and header bell rendered hardcoded mock arrays. Real notifications persisted to the DB but were never visible except as transient ContextPill toasts.
  *Resolution:* Added `GET /api/notifications`, `PATCH /api/notifications/:id/read` (ownership-enforced), `POST /api/notifications/read-all`, and `DELETE /api/notifications`. Storage gained `markNotificationAsReadForUser`, `markAllNotificationsAsRead`, and `deleteAllNotificationsForUser`. Both UI components now use TanStack Query against the live API; live WebSocket pushes still invalidate the cache.

- [x] **IDOR on Project Progress** — `server/routes/projects.ts` — **FIXED**
  `PUT /api/projects/:id/progress` checked only that *some* user was logged in — any authenticated user could set any project's progress by ID.
  *Resolution:* Now requires authentication plus role-based ownership: the project owner (student), the supervising faculty (topic proposer **or** current group supervisor), or Coordinator/Admin. Removed the request-body console logging.

- [x] **WebSocket Identity Spoofing** — `server/websocket.ts` — **FIXED**
  Clients self-declared identity via `/ws?userId=N` with zero verification — anyone could subscribe to another user's real-time notifications.
  *Resolution:* The handshake now validates the signed `connect.sid` session cookie against the PostgreSQL session store (timing-safe un-signing, same secret as `setupAuth`) and derives the userId server-side. The query parameter is ignored; unauthenticated handshakes are closed with code 1008.

- [x] **Unauthenticated Dashboard Statistics** — `server/routes/stats.ts` — **FIXED** *(found during the follow-up audit)*
  `GET /api/stats` had no auth guard, leaking institution-wide statistics (student counts, project progress, department stats) to anonymous users.
  *Resolution:* Added `isAuthenticatedRequest` guard (all roles may read; data is course-filtered per existing logic).

### 🟡 MEDIUM

- [x] **Anonymous Access to Approved Topics List** — `server/routes/topics.ts:24` — **FIXED**
  `GET /api/topics/approved` previously served topics to unauthenticated callers.
  *Resolution:* Added `isAuthenticatedRequest` check requiring active authentication. Strict course isolation for students and private cache-control headers are enforced.

- [x] **Bulk Upload Dispatcher Error (`dispatcher.useMemo`)** — `client/src/components/admin/bulk-onboarding-modal.tsx` — **FIXED**
  Submitting an Excel file for bulk upload intermittently crashed with `null is not an object (evaluating 'dispatcher.useMemo')` due to rapid re-renders of Radix UI context hooks during Server-Sent Event (SSE) streaming updates.
  *Resolution:* Replaced Radix progress and switch with lightweight accessible native components, consolidated streaming progress into an atomic state object, and added Vite `dedupe: ["react", "react-dom"]`.

- [x] **User Management Truncating Accounts (Page Limit = 50)** — `server/routes/admin.ts` & `client/src/pages/user-management.tsx` — **FIXED**
  User Management only showed 50 accounts even though 700+ users were present in the database, because `GET /api/users` applied an unrequested default pagination limit.
  *Resolution:* Modified `GET /api/users` to return all accounts if pagination is not explicitly requested or `limit=all` is specified. User Management now requests all accounts and displays live tab counters.

- [x] **Course Filter (BCA / MCA) Returning Zero Accounts & Groups** — `server/db-storage.ts` & `server/routes/groups.ts` — **FIXED**
  Selecting "BCA" or "MCA" in the header course filter returned 0 student groups and 0 accounts because member courses were missing from SQL projections and course matching was case-sensitive.
  *Resolution:* Included member course in `getAllStudentGroups()` projection, added case-insensitive matching across users and groups, and preserved admin accounts in user queries.

- [ ] **Coordinator User-Edits Silently Fail (Route Shadowing)** — `server/auth.ts:238` vs `server/routes/admin.ts:117`
  `setupAuth()` registers `PATCH /api/admin/users/:id` (Admin-only) at app level **before** `registerRoutes()` mounts the intended Admin+Coordinator version. Express matches the first handler, so Coordinator edits always return 403 and the admin.ts handler is unreachable dead code.
  *Fix:* Remove one of the duplicates (keep the role-flexible router version).

- [ ] **Backup Export/Restore Loses Data & Breaks on FK Order**
  - `exportData()` (`server/db-storage.ts`) exports only users, topics, projects, groups, members — **project_assessments (grades), project_milestones, and notifications are never archived**, so year-change backups silently drop all evaluation history.
  - `importData()` inserts **users before student_groups**, but `users.group_id` has an FK to `student_groups.id` → every user row carrying a `groupId` violates the constraint, is caught, logged, and **silently skipped** during restore.
  *Fix:* Export/import all tables; import in dependency order (groups → users → members → topics → projects → assessments → milestones).

- [ ] **Dashboard "Recent Activity" Is Fake** — `server/routes/stats.ts`
  `GET /api/activities` returns a hardcoded mock list shown to Coordinators/Admins as if it were live department activity.
  *Fix:* Derive from recent rows (topics approved, teams created, assessments posted) or remove the widget until implemented.

### ⚪ LOW

- [ ] **Notification Preferences Stub** — `server/routes/users.ts:41`
  `PATCH /api/user/notifications` returns success without persisting anything.
- [ ] **Misleading Import Success Message** — `client/src/pages/system-management.tsx`
  Toast says "Please log in again" and force-redirects to `/auth`, but imports now preserve the importing admin's session server-side.
- [ ] **Dead Code: Redundant HTTP Server** — `server/routes/index.ts:26`
  `registerRoutes()` builds its own `http.Server` that `index.ts` discards and recreates. Confusing for maintainers; delete it.

---

## ✅ Completed (v1.0.1)

### Security Enhancements
- [x] **Rate Limiting** — Added `express-rate-limit` on `/api/login` and `/api/register` (5 requests per 15-min window per IP).
- [x] **Security Headers** — Integrated `helmet` middleware for robust HTTP headers (X-Frame-Options, HSTS, CSP in production, etc.).

### Database and ORM
- [x] **Soft Deletes** — Implemented `is_deleted` boolean on `users` and `project_topics` tables. `deleteUser()` and `deleteProjectTopic()` now perform `UPDATE ... SET is_deleted = true` instead of `DELETE`. All query methods filter out soft-deleted records.
- [x] **Migration Pipeline** — Stripped broken file-based migrator in `db.ts` and formally standardized on `drizzle-kit push` for schema synchronization.

### Frontend Architecture
- [x] **Error Boundaries** — Created a global `ErrorBoundary` component wrapping the entire app in `App.tsx`. Unhandled JS errors now show a styled fallback UI with a retry button instead of crashing the page.
- [x] **Optimistic UI Updates** — Approve and Reject mutations on the Topic Approval page now use TanStack Query's `onMutate` for instant cache updates with automatic rollback on failure.

---

## ✅ Completed (v1.1.2)

### UX & Feature Enhancements
- [x] **Real-Time Notifications** — Added real-time notifications via WebSockets. Replaced polling mechanism with instant updates. Implemented role-based routing (e.g. students don't see topic approvals; admins see coordinator modifications).
- [x] **Interactive Dashboard Widgets** — StatsCards are now clickable, routing users directly to respective detail pages with hover animations.
- [x] **UI & Theming Revamp** — Overhauled the color palette for AAA high-contrast standards. Created a unified slate-based color scheme across Light and Dark themes.

### Terminology & Deployment
- [x] **Terminology Refactoring** — Renamed "Faculty" and "Teacher" keywords to "Supervisor" throughout the entire system (DB columns, roles, UI components, API endpoints).
- [x] **Windows Server Deployment** — Created `start_server.bat` for one-click production deployments on Windows.

---

## ✅ Completed (v1.2.0)

### Manage Project & Supervisor Allotment
- [x] **Manage Project Page** — New standalone page (`/manage-project`) for Admins and Coordinators to view all student groups, their members, and assigned supervisors.
- [x] **Manual Supervisor Reassignment** — Admins and Coordinators can change the supervisor assigned to any student group via a "Change Supervisor" dialog with a dropdown of all available supervisors.
- [x] **Reassignment Notifications** — Both the newly assigned and previously assigned supervisors receive real-time notifications when a reassignment occurs.
- [x] **Backend APIs** — Added `GET /api/student-groups` and `PATCH /api/student-groups/:groupId/supervisor` endpoints (Admin/Coordinator only).
- [x] **Sidebar Navigation** — Added "Manage Project" link under Main Navigation for Admin/Coordinator roles.

---

## ✅ Completed (v1.3.0)

### Course Segregation & Project Team Management
- [x] **Strict Size Constraints** — BCA student teams restricted to 2-5 members; MCA student teams restricted to 1-2 members.
- **Course Isolation** — Implemented strict course isolation so BCA students can only group with BCA students, and MCA with MCA.
- [x] **Member Management API** — New `PATCH /api/student-groups/:groupId/members` allows Admins, Coordinators, and the designated Supervisor to edit team memberships globally.
- [x] **Management UI Overhaul** — Added a "Create Team" and "Manage Members" Dialog in the `manage-project` page, providing Admins/Coordinators powerful autocomplete search tools for team curation.
- [x] **Real-Time Edit Notifications** — Added WebSocket notifications to Admins, Coordinators, and the Team Supervisor whenever a team's members are edited.

### Frontend Architecture & Accessibility
- [x] **Accessibility (a11y)** — Audited the app for WCAG compliance, ensured proper ARIA labels on all interactive elements (icon buttons, search inputs), validated keyboard navigation support, and verified sufficient color contrast ratios.

---

---

## ✅ Completed (v1.4.0)

### MCA Topic Selection Workflow
- [x] **MCA Student Suggestions** — MCA students can now propose multiple topics directly to their assigned supervisor.
- [x] **Supervisor Endorsement** — Supervisors have a dedicated tab to review, endorse, or reject topics proposed by their MCA students.
- [x] **Auto-Project Assignment** — When a Coordinator or Admin approves an endorsed MCA topic, the system automatically transitions the project status to active.

### Performance
- [x] **Server-Side Pagination** — Implemented for large list endpoints to reduce payload size.
- [x] **API Response Caching** — Added `Cache-Control` headers for read-heavy endpoints like `/api/topics/approved`.
- [x] **Bundle Size Optimization** — Audited and optimized client bundle dependencies.

### Database and ORM
- [x] **N+1 Query Problem** — Replaced `Promise.all` loops with Drizzle ORM `leftJoin` and `innerJoin` in data access methods (e.g. `getStudentProjects`, `getPendingTopics`).
- [x] **Database Indexing** — Added single and composite indexes on frequently queried columns (`username`, `email`, `status`+`is_deleted`) to significantly improve read performance.

---

## ✅ Completed (v1.4.1) Hotfixes

### Bug Fixes
- [x] **Frontend Array Mapping Crash (`.map is not a function`)**: Fixed a downstream bug caused by v1.4.0 server-side pagination. Frontend tables (`projects.tsx`, `user-management.tsx`, `track-progress.tsx`, etc.) were expecting arrays but received `PaginatedResponse` objects. Updated the React Query `queryFn` extractors to safely parse `.data || data`.
- [x] **Vite Build Configuration Error**: Fixed a build failure caused by `react-router-dom` missing from dependencies despite being included in `vite.config.ts` manual chunks. Replaced with `wouter` to match the project's actual router.

---

## ✅ Completed (v1.6.0)

### Critical Security Fixes
- [x] **Privilege Escalation via `/auth/register`** — Shadow registration endpoint deleted; all registration flows through `/api/register` with single-Admin/Coordinator enforcement.
- [x] **Password Hash Exposure** — `/auth/login` sanitized; `GET /api/supervisors` now requires authentication and returns a safe projection only.
- [x] **Progress IDOR** — `PUT /api/projects/:id/progress` now enforces role-based ownership (owner / topic supervisor / group supervisor / Coordinator+Admin).

### High Priority Fixes
- [x] **Notification Inbox** — Full persistent notification API (`GET`, mark-read, read-all, clear) with ownership enforcement; header bell and `/notifications` page wired to live data instead of hardcoded mocks.
- [x] **WebSocket Identity Spoofing** — Handshake authenticates via the signed session cookie; userId is derived server-side.
- [x] **Unauthenticated `/api/stats`** — Guard added.

### Hard Reset & Backup Integrity
- [x] **True Fresh-Install Reset** — Transactional `TRUNCATE ... RESTART IDENTITY`; sequences restart at 1; default admin recreated via canonical seeding; live WebSocket sockets disconnected; admin password verified before wipe; session destroyed + cookie cleared.
- [x] **Import Safety** — Sequences re-synced past imported `MAX(id)` (no silent PK collisions); importer session preserved.

### Production Deployment (Windows Server)
- [x] **Fail-Fast Schema Verification** — Startup now verifies all 9 core tables exist; a fresh database no longer boots into a broken state (`relation "users" does not exist`).
- [x] **Unified DB Configuration** — `DATABASE_URL` is the single source of truth across the runtime, drizzle-kit, and bootstrap tooling; `DB_*` variables supported as fallback. Split-brain (schema tooling and server targeting different databases) is impossible by construction.
- [x] **`npm run db:ensure`** — Non-destructive bootstrap: connectivity diagnostics, schema creation only when missing, safe schema sync on updates.
- [x] **One-Click `start_server.bat`** — Node check, `.env` bootstrap, dependency install, database preparation, build, and start with full error trapping (previous version could not chain commands).

---

## 🔴 Remaining / New Improvements

### 🏰 Secure like Fort Knox
- **Zero Trust Architecture**: Implement strict zero-trust network boundaries, rigorous API payload validation (using Zod with strict mode), and mTLS for internal services if introduced.
- **Advanced Threat Protection**: Integrate WAF (Web Application Firewall), automated DDoS protection, and IP anomaly detection to prevent malicious traffic.
- **End-to-End Encryption (E2EE)**: Implement client-side encryption for highly sensitive fields (like personal data) before it even hits the server.
- **Biometric / WebAuthn Support**: Add Passkeys and hardware security key support (YubiKey, TouchID, FaceID) for un-phishable multi-factor authentication.

### 🏎️ Fast like a Bugatti (Performance & Speed)
- **Edge Caching & CDN**: Serve all static assets and localized frontend builds directly from edge nodes (e.g., Cloudflare/Vercel) to achieve sub-50ms latency globally.
- **Database Read Replicas & In-Memory Caching**: Configure cross-region read replicas with aggressive query caching using Redis to handle read-heavy dashboard loads instantly.
- **Wasm (WebAssembly) Processing**: Move heavy client-side computations (e.g., parsing massive Excel sheets) to WebAssembly modules for near-native execution speed.
- **Streaming SSR**: Implement server-side rendering with suspense streaming so users see critical UI immediately while data fetches in the background.

### ⚡ Agile like a Porsche (Developer Experience & Flexibility)
- **Feature Flags & Canary Deployments**: Introduce a robust feature-flagging system to instantly toggle features, enabling trunk-based development and risk-free experiments.
- **Micro-Frontends**: Decouple the React app into module-federated micro-frontends allowing independent domains (like Admin vs Student portals) to ship rapidly.
- **Fully Automated CI/CD Pipelines**: Implement multi-stage workflows with auto-provisioned preview environments for every pull request, running complete E2E test suites in parallel.
- **Event-Driven Architecture**: Refactor core state changes to use event sourcing and message queues (like RabbitMQ or Kafka), making the backend highly decoupled and extremely adaptable.

### 📐 Futuristic like a Cybertruck (UI/UX & Innovation)
- **AI-Powered Analytics (Chat with your Data)**: Integrate LLM-based chat interfaces directly into the dashboard so admins can type natural language queries (e.g., "Show me all pending MCA topics").
- [x] **Spatial / Glassmorphic UI**: Implement a cutting-edge design system utilizing glassmorphism, dynamic backdrop filters, and fluid micro-animations that feel like a modern Spatial OS.
- [x] **3D / WebGL Visualizations**: Replace standard charts with interactive, hardware-accelerated 3D data visualizations (using Three.js) for a stunning, sci-fi data experience.
- **Predictive Prefetching**: Use machine learning to predict user navigation paths and pre-load data/assets before they even click the button.
- **Voice-Driven Navigation & Commands**: Integrate Web Speech API for voice-activated navigation and hands-free dashboard control, making the UI feel like interacting with a sci-fi AI assistant.
- [x] **Dynamic Context Pill**: Implement a floating, animated status pill at the top of the UI (inspired by iOS Dynamic Island) that smoothly expands to show background tasks, active uploads, or incoming notifications (intercepting global toasts) without obscuring the main view.
- [x] **Holographic Data Grids**: Upgrade standard data tables to holographic grids with perspective tilting (using `framer-motion` 3D transforms) when hovered, giving flat data a tactile, augmented-reality feel.
- **Cursor-Tracking Spotlight**: Implement a radial gradient spotlight that follows the user's mouse cursor across the dashboard, gently illuminating the borders of cards and interactive elements as the mouse passes over them.
- [x] **Physics-Based Micro-Interactions**: Use advanced physics-based spring animations for every button press, drag-and-drop, and modal open, making the interface feel heavy, responsive, and physically grounded.
- [x] **Animated Auth Splash Screens**: Implement professional, university-grade animated splash screens for Login and Logout events, utilizing intense glassmorphism, Framer Motion, and Spatial OS aesthetics.
- **Generative UI Soundscapes**: Introduce subtle, toggleable UI sound design (using the Web Audio API) where hovering, clicking, and page transitions generate soft, futuristic sci-fi sound effects that provide auditory feedback for physical interactions.
- **Biometric Passkeys (WebAuthn)**: Enable fingerprint and Face ID login for ultra-fast, passwordless authentication using the WebAuthn API.
- **Offline-First PWA Mode**: Convert the portal into a Progressive Web App (PWA) with Service Workers to allow users to view project data offline and auto-sync when reconnected.
- **AI Form Auto-Completion**: Use an LLM to pre-fill lengthy forms (like project topic submissions) based on a single sentence description provided by the user.

### 1. Authentication Modernization
- **Password Policy Enforcement**: Add validation for minimum password length (8+ chars), complexity requirements (uppercase, number, special char), and prevent common passwords.

### 2. Code Quality and Testing
- **Automated Testing Suite**: There are currently no unit tests or E2E tests.
  - `Vitest` for unit testing utility functions, Zod schemas, and React hooks.
  - `Playwright` or `Cypress` for end-to-end testing of critical workflows (Topic Approval, Group Formation, Login).
- **Controller Separation**: Business logic currently lives inside route handler callbacks in `server/auth.ts` and `server/routes.ts`. Extract this into dedicated controller files (e.g., `server/controllers/topicController.ts`, `server/controllers/userController.ts`) for better testability and separation of concerns.
- **Input Sanitization**: Add server-side sanitization (e.g., `xss` or `DOMPurify` on the server) for user-generated text fields (topic descriptions, feedback, group names) to prevent stored XSS attacks.

### 4. Frontend Architecture
- **React Suspense for Data**: Leverage React Suspense with TanStack Query's `useSuspenseQuery` for a more declarative loading state approach, reducing boilerplate `isLoading` checks.
- **Form Validation UX**: Ensure all forms display inline validation errors as the user types (not just on submit), using `react-hook-form`'s `mode: 'onBlur'` or `mode: 'onChange'`.

### 5. Performance
- **Image Optimization**: If profile pictures or file uploads are added in the future, implement server-side compression and responsive image serving.

### 6. DevOps & Deployment
- **Environment Variable Validation**: Use Zod to validate all required environment variables at server startup (e.g., `DATABASE_URL`, `SESSION_SECRET`), failing fast with clear error messages if any are missing.
- **Health Check Endpoint**: Add a `/api/health` endpoint that returns the server status and database connectivity, useful for load balancers and monitoring.
- **Structured Logging**: Replace `console.log` / `console.error` calls with a structured logger (e.g., `pino` or `winston`) that supports log levels, JSON output, and timestamps for production debugging.
- **Docker Support**: Add a `Dockerfile` and `docker-compose.yml` for containerized development and deployment with PostgreSQL.

### 7. UX & Feature Gaps
- **Email Notifications**: Integrate an email service (e.g., `nodemailer` + SMTP or a transactional email API) for critical events like group invitations and topic approval/rejection.
- **File Uploads**: Allow students to upload project reports/documents attached to milestones.
- **Audit Log**: Maintain a system-wide audit trail recording who performed what action and when, especially for admin operations like database resets and user deletions.

### 8. System Architecture & Scalability
- **Background Jobs System**: Integrate a message queue (e.g., `BullMQ` or `pg-boss`) for offloading long-running tasks like batch email notifications, generating heavy Excel/PDF reports, or processing periodic project progress summaries.
- **Advanced Rate Limiting**: Extend the current rate limiting beyond just authentication. Implement distinct limits for expensive endpoints (e.g., large data exports) and write-heavy endpoints (e.g., topic submissions) to prevent system abuse.
- **API Documentation**: Auto-generate OpenAPI/Swagger documentation directly from Zod schemas (using `zod-openapi` and `swagger-ui-express`) to create a live API testing interface for developers.

### 9. Extended Administrative Capabilities
- **Multi-Department Support**: Lay the groundwork for multi-tenant behavior so a single APMS instance can manage completely isolated data for multiple departments (e.g., CS, IT, Mechanical) under different Department Heads.
- **Granular RBAC System**: Migrate from simple role arrays (e.g., `requireRole([Admin, Coordinator])`) to a more granular, attribute-based access control system (like `CASL`) where permissions can be dynamically defined at the database level.

### 10. Frontend Polish
- **Mobile Responsiveness Audit**: Conduct a comprehensive pass on complex data grids (Project Table, User Management) and multi-step dialogs to ensure they are fully usable on smaller mobile viewports.
- **PDF Export Capabilities**: Supplement the existing Excel exports with client-side or server-side PDF generation (e.g., `react-pdf` or `Puppeteer`) for official, print-ready reports.
