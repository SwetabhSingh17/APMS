# APMS (Academic Project Management System) - AI Context

## Purpose
This document provides comprehensive context about the APMS project. It is intended to be read by LLMs and AI assistants to quickly understand the project's architecture, technologies, data flow, and workflows, avoiding the need to explore every file.

---

## 1. Project Overview
APMS is a comprehensive web-based project management system for educational institutions. It streamlines project topic approval, project team formation, supervisor mentoring, and progress tracking.

### Core Workflows:
1. **Topic Proposals**: 
   - **BCA**: Supervisors submit project topics. Coordinators review and approve them. Students then select from the approved pool.
   - **MCA**: Coordinators assign Supervisors to Students. MCA Students propose multiple topics directly to their assigned Supervisor. Supervisors use a dedicated "Student Suggestions" tab to review, endorse, or reject topics. Once endorsed by the Supervisor and approved by the Coordinator/Admin, the project status automatically transitions to active (Auto-Project Assignment).
2. **Project Teams**: Students form groups, invite peers, and select approved topics. Strict course-based size limits are enforced: BCA teams must have 2 to 5 members, while MCA teams must have 1 to 2 members. Admins and Coordinators have exclusive authority to create single-member BCA teams and manage team members globally. Students and Supervisors do not have access to modify team rosters or leave teams; only Administrators and Coordinators can add, edit, or remove team members.
3. **Mentorship & Tracking**: Supervisor mentors evaluate group progress, grade milestones, and provide final assessments.
4. **Manage Project (Supervisor Allotment)**: Admins and Coordinators can view all project teams and manually reassign their supervisors via the dedicated `/manage-project` page with a searchable dropdown.
5. **Course Segregation**: The system strictly segregates operations based on the Student's course (BCA or MCA). Students are isolated to their course context, while Admins, Coordinators, and Supervisors use a global UI `CourseFilterContext` toggle to switch contexts. Course filtering across users, groups, and topics employs case-insensitive matching (`UPPER(course)`) and includes member-level affiliations while preserving administrative visibility.
6. **Administration**: Admins manage users, generate Excel reports, and oversee system settings (including database backups/resets). User management supports complete roster retrieval (`limit=all`) with real-time tab counters and role segmentation.
7. **Bulk Excel Onboarding, Real-Time Progress & First-Login Security**: Coordinators and Admins can bulk-provision cohorts from multi-sheet Excel files with live SSE progress streaming (tracking network upload, multi-sheet parsing, cryptographic account batching, and team formation). Built with an atomic progress state and native UI elements to eliminate React hook dispatcher desynchronization. The system automatically provisions accounts with initial passwords set to their enrollment number, forms project teams by `projectTeamId`, and sets `forcePasswordReset = true`. A non-dismissible modal and backend security interceptor enforce a mandatory password change on first login before operational APIs are accessible.

---

## 2. Technology Stack
- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, shadcn/ui, wouter (routing), TanStack Query, Framer Motion, Recharts.
- **Backend**: Node.js, Express.js.
- **Database**: PostgreSQL (Neon Serverless / Vercel Postgres compatible).
- **ORM & Validation**: Drizzle ORM, Zod, drizzle-zod.
- **File Parsing & Generation**: ExcelJS (multi-sheet workbook support with merged-cell safety).
- **Database Sync**: `drizzle-kit push` is used for schema synchronization (no file-based migrations).
- **Authentication**: Passport.js (Local Strategy), express-session, connect-pg-simple.
- **Security & Resilience**: Helmet (HTTP headers), express-rate-limit, React Error Boundaries, first-login security interceptor.

---

## 3. Project Structure
The repository is structured as a monorepo-style full-stack application:
- `client/src/`: Frontend React application.
  - `/pages`: Route-level components.
  - `/components/ui`: Shadcn UI primitives.
  - `/components/admin`: Admin modals (e.g. `bulk-onboarding-modal.tsx`).
  - `/components/auth`: Authentication components (e.g. `force-password-reset-modal.tsx`).
  - `/components/layout`: Application shell (sidebar, header).
  - `/lib`: Utilities, Query client, and protected route logic.
- `server/`: Backend Express API.
  - `index.ts`: Application entry point.
  - `auth.ts`: Authentication, passport setup, security interceptor, and rate-limiting.
  - `routes/`: Modular API route files (`auth.ts`, `users.ts`, `projects.ts`, `topics.ts`, `groups.ts`, `stats.ts`, `admin.ts`, `notifications.ts`).
  - `services/`: Service layer (`onboarding-parser.ts` for ExcelJS parsing and demo generation).
  - `db.ts`: Database connection with unified config resolution (`DATABASE_URL` takes precedence over `DB_*` variables), plus boot-time schema verification (`runMigrations()` fails fast if any of the 9 core tables are missing).
  - `db-storage.ts`: Database interaction layer using Drizzle ORM (repository pattern, bulk onboarding provisioning).
  - `websocket.ts`: Session-authenticated WebSocket server for real-time notification delivery.
- `shared/`: Types and schemas shared between client and server.
  - `schema.ts`: Core Drizzle tables, Zod schemas, and TypeScript interfaces (`IUser`, `IStudentGroup`, etc.).
- `scripts/`: DB seeding, backup, restore, setup, reset, and verification scripts.
  - `ensure_db.ts`: Production-safe bootstrap used by `start_server.bat` (`npm run db:ensure`).
  - `verify_onboarding_and_access_control.ts`: Automated test suite for bulk onboarding, team linking, and access control.
  - `setup_db.ts`: Full destructive reset (wipes schema, pushes tables, seeds admin). Aliased as `db:hard-reset`.
---


## 4. Database Schema (drizzle)
The application relies on several core tables defined in `shared/schema.ts`:
- **users**: Stores all accounts with role-based access (`admin`, `coordinator`, `supervisor`, `student`). Student roles have a required `course` column (`BCA` or `MCA`), `enrollmentNumber`, and `forcePasswordReset` boolean flag. Soft deletes are implemented via an `is_deleted` column.
- **student_groups**: Student project groups containing `course` (`BCA` or `MCA`), `projectTeamId` (e.g., `A-01`), `supervisorId`, `maxSize`, and `createdById`.
- **student_group_members**: Manages team memberships and invitation statuses (`pending`, `accepted`, `rejected`).
- **project_topics**: Topics proposed by supervisors, requiring a `course` property (`BCA` or `MCA`) and a `status` (`pending`/`approved`/`rejected`/`pending_supervisor`).
- **student_projects**: Maps groups/students to topics with progress tracking.
- **project_assessments**: Grades and feedback provided by supervisor.
- **project_milestones**: Distinct checkpoints for student projects.
- **notifications**: In-app notifications for users.
- **sessions**: Session storage for `express-session`.

---

## 5. Real-Time Notification System & Routing Logic
APMS includes a robust real-time notification system powered by WebSockets with a persistent per-user inbox.
- **Infrastructure**: A `WebSocketServer` runs on the same HTTP port (path `/ws`). The handshake is session-authenticated: the server un-signs the `connect.sid` cookie (timing-safe, same secret as `setupAuth`), loads the session from PostgreSQL, and derives the userId from `session.passport.user`. Unauthenticated handshakes are closed with code 1008. The system broadcasts `NOTIFICATION` events strictly to the target user's active socket connections.
- **Persistence & API**: Notifications are stored in the `notifications` table and served via `GET /api/notifications` (newest first). Supporting endpoints: `PATCH /api/notifications/:id/read` (ownership-enforced), `POST /api/notifications/read-all`, and `DELETE /api/notifications` (clear own). The header bell dropdown and the `/notifications` page consume these via TanStack Query.
- **Frontend Integration**: The `useNotifications` hook in `client/src/App.tsx` establishes the connection. When a notification is received, it triggers a UI `toast()` popup ("notification blob") and automatically invalidates the `["/api/notifications"]` TanStack Query cache to instantly refresh the bell dropdown and notifications page.
- **Advanced Routing Rules**: Only relevant stakeholders receive notifications.
  - *Supervisor Allocation*: When a Supervisor is assigned or reassigned to a Project Team, the newly assigned, previously assigned, and specific group's Students are notified.
  - *Topic Approvals*: When a Coordinator approves a topic, the Supervisor who proposed it and all Admins receive notifications. Students are not notified.
  - *Account Changes*: If a Coordinator creates or modifies an account, all Admins are instantly notified.
  - *Team Edit Notifications*: Admins, Coordinators, and the relevant Supervisor are notified whenever a team's members are modified.
  - *MCA Endorsements*: Supervisors are alerted of new student suggestions, and students are alerted of endorsement/approval decisions.

---

## 6. Architectural Patterns & Guidelines
1. **API Communication**: The frontend uses TanStack Query (`@tanstack/react-query`) for data fetching, caching, and state synchronization with the Express backend.
2. **Pagination**: APIs utilize server-side pagination, returning `PaginatedResponse` objects instead of raw arrays for tables to handle large datasets efficiently.
3. **Routing**: The application uses `wouter` for lightweight client-side routing.
4. **Styling**: Tailwind CSS is used extensively alongside Radix UI primitives encapsulated in `shadcn/ui` components.
5. **Form Handling & Validation**: `react-hook-form` is used in combination with `@hookform/resolvers/zod`. Zod schemas defined in `shared/schema.ts` act as the single source of truth for both frontend form validation and backend request validation.
6. **Database Queries**: All database interactions should go through the Drizzle ORM. Raw SQL is discouraged. Data access logic is encapsulated in `server/db-storage.ts`. Soft deletes are implemented via the `is_deleted` column across major tables, so queries must filter `eq(table.isDeleted, false)`.
7. **UI Design System (Spatial OS)**: The application features a highly premium, Cybertruck/Spatial OS-inspired aesthetic utilizing intense glassmorphism, dynamic backdrop filters, and fluid micro-animations. Key elements include:
   - *Animated Auth Splash Screens* (e.g., "WELCOME_ [USERNAME]") intercepting login/logout events.
   - *Dynamic Context Pill*: Floating, iOS Dynamic Island-inspired context pill replacing traditional bottom toasts.
   - *Holographic Data Grids*: Tables featuring perspective tilting via Framer Motion 3D transforms.
   - *Physics-Based Micro-Interactions*: Spring animations for button presses, hover states, and modals.
8. **Performance & Caching**: Cache headers are implemented for read-heavy API endpoints to reduce database queries.
9. **Database Configuration & Bootstrap**: `DATABASE_URL` is the single source of truth — parsed by the runtime (`server/db.ts`), `drizzle.config.ts`, and `scripts/ensure_db.ts`. The `DB_*` variables act as a fallback style. `ensure_db.ts` injects the runtime-resolved URL into drizzle-kit child processes, so schema operations can never target a different database than the running server. `npm run db:ensure` is safe to run on every start (creates missing tables + default admin, syncs schema changes, never wipes).
10. **Destructive Operations**: The hard reset (`POST /api/admin/reset`) requires the admin's password (verified via scrypt) and performs a transactional `TRUNCATE ... RESTART IDENTITY CASCADE` — sequences restart at 1 and the default admin is recreated, yielding exact `npm run db:setup` parity. Backup import re-syncs table sequences past imported `MAX(id)` values to prevent PK collisions.
11. **Documentation & Future Roadmap**: `Fixes_required.md` serves as the backlog for architectural and feature proposals (e.g., Background Jobs, Advanced Rate Limiting, OpenAPI generation, Multi-Department Support, PDF generation).

---

## 7. Access Control (RBAC)
- **Student**: Can browse topics, form groups, invite members, submit milestones. Segregated by Course (BCA/MCA).
- **Supervisor**: Can propose topics, evaluate assigned groups, grade milestones, and manage MCA topic endorsements.
- **Coordinator**: Can approve/reject topic proposals, oversee all projects, view department stats, and manually reassign supervisors to project teams via the Manage Project page.
- **Admin**: Has full access, can perform destructive actions (DB resets), manage all users, and reassign supervisors.
