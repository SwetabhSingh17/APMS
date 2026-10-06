---
last_mapped_commit: a672e1e53b1e5280fad2d5fdeb2795de95133954
last_mapped_at: 2026-10-06
---
<!-- refreshed: 2026-10-06 -->

# Architecture

**Analysis Date:** 2026-10-06

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Client Tier (React 18 + Wouter SPA)                    │
├───────────────────────┬───────────────────────────┬─────────────────────────┤
│  Pages & Views        │  State & Cache Layer      │  UI Primitives & Theme  │
│  `client/src/pages/`  │  `client/src/lib/`        │  `client/src/components/`│
└───────────┬───────────┴─────────────┬─────────────┴────────────┬────────────┘
            │                         │                          │
            ▼ (HTTP / REST APIs)      │                          ▼ (WebSocket)
┌─────────────────────────────────────┴───────────────────────────────────────┐
│                       Server Tier (Node.js + Express 4)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routing & Security: `server/routes/`, `server/auth.ts`, `server/websocket.ts`│
│  - Passport Session Auth, Helmet Headers, Rate Limiting, RBAC Guards         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Services & Ingestion: `server/services/`                                   │
│  - Excel parsers (Students, Supervisors, Topics) with SSE Streaming         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Data Access Layer: `server/db-storage.ts`                                  │
│  - Drizzle ORM repository methods, joins, self-healing sync logic           │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼ (PostgreSQL Connection / Pooling)
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Database Tier (PostgreSQL)                            │
│  Drizzle Schema: `shared/schema.ts` | Sessions: `sessions` table            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App Shell & Router | Configures global providers, error boundary, and protected route matching | `client/src/App.tsx` |
| Auth Hook & Context | Manages active user authentication session, login/logout mutations, and query cache clearing | `client/src/hooks/use-auth.tsx` |
| HTTP Client & Query Client | Configures TanStack Query with custom `apiRequest`, abort timeouts, and `ApiError` class | `client/src/lib/queryClient.ts` |
| Role & Route Guard | Enforces authentication and role-based permissions (`UserRole`) for view access | `client/src/lib/protected-route.tsx` |
| Server Bootstrap | Bootstraps Express, HTTP security headers, request logging, and static asset serving | `server/index.ts` |
| Auth Controller & Strategy | Passport.js LocalStrategy, scrypt password hashing, session serialization, rate limiting | `server/auth.ts` |
| Storage & ORM Repository | Encapsulates all database operations, transactional writes, and join queries | `server/db-storage.ts` |
| Database Engine | Manages PostgreSQL connection strings, client pooling, and schema initialization verification | `server/db.ts` |
| WebSocket Notifier | Manages authenticated WebSocket connections and dispatches real-time events to user sockets | `server/websocket.ts` |
| Excel Onboarding Parsers | Ingests institutional spreadsheets, validates schemas, provisions cohorts, streams SSE progress | `server/services/` |
| Shared Schema & Contracts | Single source of truth for Drizzle table schemas, Zod validation schemas, and TypeScript interfaces | `shared/schema.ts` |

## Pattern Overview

**Overall:** Modular Layered Monolith with Client-Side Single Page Application (SPA).

**Key Characteristics:**
- **Shared Schema Contract**: `shared/schema.ts` provides universal data modeling used by both Vite frontend and Express backend.
- **Repository Pattern**: `server/db-storage.ts` acts as the single data-access abstraction (`DBStorage`), hiding raw SQL queries behind typed methods.
- **Role-Based Access Control (RBAC)**: Fine-grained authorization enforced on both client routes (`client/src/lib/protected-route.tsx`) and backend REST endpoints (`requireRole` in `server/auth.ts`).
- **Reactive Cache Synchronization**: Frontend views use TanStack React Query with predictive and predicate-based invalidations paired with WebSocket event triggers.

## Layers

**Presentation Layer (Frontend):**
- Purpose: Render user interfaces, forms, tables, 3D widgets, and reactive dialogs.
- Location: `client/src/`
- Contains: React components, pages, custom hooks, and Tailwind styling.
- Depends on: Shared schema types (`@shared/schema`), TanStack Query, Radix UI.
- Used by: End users (Students, Supervisors, Coordinators, Administrators).

**API & Routing Layer (Backend):**
- Purpose: Expose authenticated REST endpoints, validate incoming request bodies, and orchestrate HTTP responses.
- Location: `server/routes/`
- Contains: Express route modules (`admin.ts`, `groups.ts`, `projects.ts`, `topics.ts`, `users.ts`, `stats.ts`, `notifications.ts`, `auth.ts`).
- Depends on: `DBStorage`, auth middleware (`requireRole`), shared schemas.
- Used by: Client HTTP requests and WebSocket handshakes.

**Service Layer:**
- Purpose: Parse external spreadsheets, stream SSE progress, and generate Excel demo templates.
- Location: `server/services/`
- Contains: `onboarding-parser.ts`, `supervisor-onboarding-parser.ts`, `topic-onboarding-parser.ts`.
- Depends on: `exceljs`, `xlsx`, `shared/schema.ts`.
- Used by: Admin routes for batch onboarding.

**Data Access & Storage Layer:**
- Purpose: Interface with the PostgreSQL database through Drizzle ORM, execute optimized join queries, and enforce relational consistency.
- Location: `server/db-storage.ts`
- Contains: `DBStorage` class with all query, insert, update, soft-delete, and conflict resolution logic.
- Depends on: `server/db.ts`, `shared/schema.ts`, `drizzle-orm`.
- Used by: Route handlers across `server/routes/`.

**Persistence Layer:**
- Purpose: Relational data storage and session persistence.
- Location: PostgreSQL database (`shared/schema.ts`).
- Contains: Tables `users`, `student_groups`, `student_group_members`, `project_topics`, `student_projects`, `project_milestones`, `project_assessments`, `notifications`, `session`.

## Data Flow

### Primary Request Path (Student Topic Selection Flow)

1. **Student initiates selection**: Student clicks topic card on `/student-topics` and confirms in `AlertDialog` (`client/src/pages/student-topics.tsx`).
2. **HTTP Request**: Frontend calls `apiRequest("POST", "/api/projects", { topicId })` (`client/src/lib/queryClient.ts`).
3. **Route & Auth Guard**: Express matches `POST /api/projects` in `server/routes/projects.ts`, authenticates session, verifies user has role `student`.
4. **Validation & Checks**: Endpoint verifies that the student belongs to a group, the group has no prior topic, and the topic is approved.
5. **Database Transaction**:
   - Creates project records in `studentProjects` for all group members (`server/db-storage.ts`).
   - Automatically synchronizes `studentGroups.supervisorId = topic.submittedById` (`server/routes/projects.ts`).
6. **Real-Time Notification**: Dispatches WebSocket notification to the allotted supervisor and team members (`server/websocket.ts`).
7. **Cache Invalidation & UI Update**: React Query invalidates `["/api/topics/approved"]` and `["/api/projects"]`, triggering instantaneous UI refresh across all tabs.

### Secondary Flow (Bulk Excel Student Onboarding)

1. **Coordinator uploads Excel**: Selects multi-sheet `.xlsx` file in `client/src/components/admin/bulk-onboarding-modal.tsx`.
2. **SSE Connection & Upload**: POSTs `multipart/form-data` to `/api/admin/bulk-onboarding`, establishing a Server-Sent Event stream.
3. **Parsing & Batch Processing**: `server/services/onboarding-parser.ts` extracts student records from each sheet, validates enrollment numbers, and generates default credentials.
4. **Fast Batch Insertion**: `server/db-storage.ts` provisions hundreds of accounts in memory and writes batch rows to `users` and `student_groups`.
5. **Real-time Telemetry**: Server pushes progress percentages (`stage: "provisioning"`, `percent: N`) back to the frontend progress bar.
6. **Completion**: Emits final `IOnboardingResult` and invalidates user and group query caches.

**State Management:**
- Server State: TanStack Query acts as the client-side server cache with automatic re-fetching on window focus and post-mutation invalidations.
- Client State: React Context (`useAuth`, `CourseFilterContext`, `ThemeProvider`) handles cross-cutting UI states (logged-in user, active course filter BCA/MCA, light/dark mode).
- Local State: React `useState` / `useReducer` for ephemeral dialog states and form inputs.

## Key Abstractions

**`DBStorage` Interface:**
- Purpose: Unified data access gateway wrapping Drizzle ORM operations.
- Examples: `server/db-storage.ts`
- Pattern: Repository / Data Mapper pattern.

**`ProtectedRoute` Component:**
- Purpose: Declarative route guard handling authentication status, role permissions, and unauthenticated redirects.
- Examples: `client/src/lib/protected-route.tsx`
- Pattern: Higher-Order Component / Guard Wrapper.

**`CourseFilterContext`:**
- Purpose: Global context allowing Administrators and Coordinators to toggle cohort views between BCA, MCA, or All cohorts.
- Examples: `client/src/hooks/course-filter-context.tsx`
- Pattern: Provider / Observer pattern.

**`ForcePasswordResetModal`:**
- Purpose: Non-dismissible security interceptor displayed on first login or after an administrative default password reset.
- Examples: `client/src/components/auth/force-password-reset-modal.tsx`
- Pattern: Interceptor / Gatekeeper pattern.

## Entry Points

**Client Entry Point:**
- Location: `client/src/main.tsx`
- Triggers: Browser document load.
- Responsibilities: Mounts React application into `#root` DOM node with React 18 `createRoot`.

**Server Entry Point:**
- Location: `server/index.ts`
- Triggers: Execution of `node dist/index.js` or `tsx server/index.ts`.
- Responsibilities: Loads environment variables, configures Express middlewares, verifies database schema, mounts API routes, starts WebSocket server, and listens on `0.0.0.0:${PORT}`.

**Database Initialization & Migration:**
- Location: `server/db.ts` and `scripts/ensure_db.ts`
- Triggers: Server startup and deployment scripts (`npm run db:ensure`, `start_server.bat`).
- Responsibilities: Tests connectivity, checks presence of core database tables, and executes migrations safely.

## Architectural Constraints

- **Threading:** Node.js single-threaded event loop. Long synchronous blocking operations must be avoided; file operations and password hashing use asynchronous APIs (`scryptAsync`, streaming SSE).
- **Global State:** Minimal module-level state: `clients` Map in `server/websocket.ts` tracks active WebSockets by user ID; Express session store maintains session state in PostgreSQL.
- **Circular Imports:** Avoided by isolating database schemas and interfaces in `shared/schema.ts`, which has zero dependencies on `server/` or `client/`.
- **Database Connection Sharing:** Drizzle ORM uses the `postgres` driver while Express session uses `pg.Pool`. Both must connect to the identical database URL to avoid split-brain states.

## Anti-Patterns

### TanStack Query Collision on Parameterized Endpoints

**What happens:** Using static string query keys like `["/api/topics/approved"]` across components that expect different response shapes (e.g., flat array vs. categorized object).
**Why it's wrong:** Causes cache collisions where one view receives data formatted for another, leading to blank screens or runtime errors.
**Do this instead:** Use distinct query keys incorporating role or scope identifiers (e.g., `["/api/topics/approved", "student"]`), as implemented in `client/src/pages/student-topics.tsx`.

### Direct Password Storage without Hashing

**What happens:** Saving raw `req.body.password` directly to database rows in administrative routes.
**Why it's wrong:** Breaks scrypt comparison during login, exposes plaintext passwords, and causes unhandled exceptions in `comparePasswords()`.
**Do this instead:** Always hash passwords with `await hashPassword(password)` before passing to `storage.updateUser()` or `storage.createUser()`.

### Bypassing Role Guards on Sensitive Endpoints

**What happens:** Relying solely on client-side route protection without server-side `requireRole()` checks.
**Why it's wrong:** Vulnerable to IDOR and privilege escalation attacks via direct curl/Postman API calls.
**Do this instead:** Every administrative route must apply `requireRole([UserRole.ADMIN, UserRole.COORDINATOR])` at the Express router level (`server/routes/admin.ts`).

## Error Handling

**Strategy:** Multi-tier defensive error handling across client and server.

**Patterns:**
- **Server-Side Try/Catch**: Route handlers wrap business logic in `try { ... } catch (error) { ... }` blocks, logging errors with contextual details and returning structured JSON (`{ message: string, code?: string }`) with appropriate HTTP status codes (400, 401, 403, 404, 500).
- **Client-Side ApiError**: `client/src/lib/queryClient.ts` parses error responses and throws instances of `ApiError` with HTTP status and machine-readable error codes.
- **React Error Boundary**: `client/src/components/ErrorBoundary.tsx` catches rendering exceptions and displays an interactive fallback card with reload options.

## Cross-Cutting Concerns

**Logging:**
- Custom middleware in `server/index.ts` logs all `/api` requests with timestamps, HTTP method, path, response status, duration, and response body preview.

**Validation:**
- Runtime input validation enforced via Zod schemas (`insertUserSchema`, `insertProjectTopicSchema`, `insertStudentGroupSchema`) defined in `shared/schema.ts`.

**Authentication:**
- Session-based authentication via Passport.js with signed cookies (`connect.sid`), validated on every HTTP request and during WebSocket handshakes.

---

*Architecture analysis: 2026-10-06*
