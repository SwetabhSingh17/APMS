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
2. **Project Teams**: Students form groups, invite peers, and select approved topics. Strict course-based size limits are enforced: BCA teams must have 2 to 5 members, while MCA teams must have 1 to 2 members. Admins and Coordinators have the exclusive privilege to create single-member BCA teams and manage team members globally. Admins, Coordinators, and Supervisors can add, edit, or remove members in a team (Supervisors restricted to teams they supervise).
3. **Mentorship & Tracking**: Supervisor mentors evaluate group progress, grade milestones, and provide final assessments.
4. **Manage Project (Supervisor Allotment)**: Admins and Coordinators can view all project teams and manually reassign their supervisors via the dedicated `/manage-project` page with a searchable dropdown.
5. **Course Segregation**: The system strictly segregates operations based on the Student's course (BCA or MCA). Students are isolated to their course context, while Admins, Coordinators, and Supervisors use a global UI `CourseFilterContext` toggle to switch contexts.
6. **Administration**: Admins manage users, generate Excel reports, and oversee system settings (including database backups/resets).

---

## 2. Technology Stack
- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, shadcn/ui, wouter (routing), TanStack Query, Framer Motion, Recharts.
- **Backend**: Node.js, Express.js.
- **Database**: PostgreSQL (Neon Serverless / Vercel Postgres compatible).
- **ORM & Validation**: Drizzle ORM, Zod, drizzle-zod.
- **Database Sync**: `drizzle-kit push` is used for schema synchronization (no file-based migrations).
- **Authentication**: Passport.js (Local Strategy), express-session, connect-pg-simple.
- **Security & Resilience**: Helmet (HTTP headers), express-rate-limit, React Error Boundaries.

---

## 3. Project Structure
The repository is structured as a monorepo-style full-stack application:
- `client/src/`: Frontend React application.
  - `/pages`: Route-level components.
  - `/components/ui`: Shadcn UI primitives.
  - `/components/layout`: Application shell (sidebar, header).
  - `/lib`: Utilities, Query client, and protected route logic.
- `server/`: Backend Express API.
  - `index.ts`: Application entry point.
  - `auth.ts`: Authentication, passport setup, and rate-limiting.
  - `routes/`: Modular API route files (`auth.ts`, `users.ts`, `projects.ts`, `groups.ts`, `topics.ts`).
  - `db.ts`: Database connection and startup connectivity validation.
  - `db-storage.ts`: Database interaction layer using Drizzle ORM (repository pattern).
  - `websocket.ts`: WebSocket server for real-time notification delivery.
- `shared/`: Types and schemas shared between client and server.
  - `schema.ts`: Core Drizzle tables, Zod schemas, and TypeScript interfaces.
- `scripts/`: DB seeding, backup, restore, setup, and reset scripts.
  - `setup_db.ts`: Unified database installation (wipes public schema, pushes tables, inits default admin).
  - `hard_reset.ts`: Aliased to setup_db.ts for safe resetting.
---

## 4. Database Schema (drizzle)
The application relies on several core tables defined in `shared/schema.ts`:
- **users**: Stores all accounts with role-based access (`admin`, `coordinator`, `supervisor`, `student`). Student roles have a required `course` column (BCA or MCA). Soft deletes are implemented via an `is_deleted` column.
- **student_groups**: Student project groups containing `course`, `supervisorId`, `maxSize`, and `createdById`.
- **student_group_members**: Manages team memberships and invitation statuses.
- **project_topics**: Topics proposed by supervisors, requiring a `course` property and a `status` (pending/approved/rejected).
- **student_projects**: Maps groups/students to topics with progress tracking.
- **project_assessments**: Grades and feedback provided by supervisor.
- **project_milestones**: Distinct checkpoints for student projects.
- **notifications**: In-app notifications for users.
- **sessions**: Session storage for `express-session`.

---

## 5. Real-Time Notification System & Routing Logic
APMS includes a robust real-time notification system powered by WebSockets.
- **Infrastructure**: A `WebSocketServer` runs on the same HTTP port (path `/ws`). Clients connect and pass their `userId`. The system broadcasts `NOTIFICATION` events strictly to the target user's active socket connections.
- **Frontend Integration**: The `useNotifications` hook in `client/src/App.tsx` establishes the connection. When a notification is received, it triggers a UI `toast()` popup ("notification blob") and automatically invalidates the `["/api/notifications"]` TanStack Query cache to instantly refresh the notification drawer.
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
9. **Documentation & Future Roadmap**: `Fixes_required.md` serves as the backlog for architectural and feature proposals (e.g., Background Jobs, Advanced Rate Limiting, OpenAPI generation, Multi-Department Support, PDF generation).

---

## 7. Access Control (RBAC)
- **Student**: Can browse topics, form groups, invite members, submit milestones. Segregated by Course (BCA/MCA).
- **Supervisor**: Can propose topics, evaluate assigned groups, grade milestones, and manage MCA topic endorsements.
- **Coordinator**: Can approve/reject topic proposals, oversee all projects, view department stats, and manually reassign supervisors to project teams via the Manage Project page.
- **Admin**: Has full access, can perform destructive actions (DB resets), manage all users, and reassign supervisors.
