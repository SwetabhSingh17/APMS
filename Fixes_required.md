# Fixes and Improvements Required

This document outlines suggested architectural, security, and maintenance improvements for the APMS project. These fixes are intended to enhance the codebase's scalability, maintainability, and security.

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

## 🔴 Remaining / New Improvements

### 1. Authentication Modernization
- **JWT / Stateless Auth**: The current system uses `passport-local` + `express-session` with server-side session storage. For better horizontal scalability, consider migrating to JWT-based stateless authentication. This is a large refactor touching both frontend and backend.
- **Password Policy Enforcement**: Add validation for minimum password length (8+ chars), complexity requirements (uppercase, number, special char), and prevent common passwords.

### 2. Code Quality and Testing
- **Automated Testing Suite**: There are currently no unit tests or E2E tests.
  - `Vitest` for unit testing utility functions, Zod schemas, and React hooks.
  - `Playwright` or `Cypress` for end-to-end testing of critical workflows (Topic Approval, Group Formation, Login).
- **Controller Separation**: Business logic currently lives inside route handler callbacks in `server/auth.ts` and `server/routes.ts`. Extract this into dedicated controller files (e.g., `server/controllers/topicController.ts`, `server/controllers/userController.ts`) for better testability and separation of concerns.
- **Input Sanitization**: Add server-side sanitization (e.g., `xss` or `DOMPurify` on the server) for user-generated text fields (topic descriptions, feedback, group names) to prevent stored XSS attacks.

### 3. Database and ORM
- **Database Indexing**: Add indexes on frequently queried columns:
  - `users.username`, `users.email`, `users.enrollment_number` (already unique, but ensure index exists)
  - `project_topics.status` + `project_topics.is_deleted` (composite index for filtered queries)
  - `student_group_members.user_id` + `student_group_members.group_id`
- **N+1 Query Problem**: Several methods in `db-storage.ts` (e.g., `getAllProjects`, `getPendingTopics`, `getApprovedTopics`) fetch related data inside `Promise.all(map(...))`, causing N+1 queries. Replace with Drizzle ORM joins or batch lookups for significant performance gains.

### 4. Frontend Architecture
- **React Suspense for Data**: Leverage React Suspense with TanStack Query's `useSuspenseQuery` for a more declarative loading state approach, reducing boilerplate `isLoading` checks.
- **Form Validation UX**: Ensure all forms display inline validation errors as the user types (not just on submit), using `react-hook-form`'s `mode: 'onBlur'` or `mode: 'onChange'`.

### 5. Performance
- **Server-Side Pagination**: Large list endpoints (`getAllUsers`, `getAllTopics`, `getAllProjects`) currently return the entire dataset. Implement cursor-based or offset pagination to reduce payload size and improve response times.
- **API Response Caching**: Add cache headers (`Cache-Control`, `ETag`) for read-heavy endpoints like `/api/topics/approved` to reduce redundant database queries.
- **Bundle Size Optimization**: Audit the client bundle with `npx vite-bundle-visualizer`. Consider lazy-loading heavier dependencies like `recharts`, `xlsx`, and `mermaid` only on the pages that need them.
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
