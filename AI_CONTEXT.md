# APMS (Academic Project Management System) - AI Context

## Purpose
This document provides comprehensive context about the APMS project. It is intended to be read by LLMs and AI assistants to quickly understand the project's architecture, technologies, data flow, and workflows, avoiding the need to explore every file.

---

## 1. Project Overview
APMS is a comprehensive web-based project management system for educational institutions. It streamlines project topic approval, student group formation, faculty mentoring, and progress tracking.

### Core Workflows:
1. **Topic Proposals**: Teachers submit project topics. Coordinators review and either approve or reject them.
2. **Student Groups**: Students form groups (default max size: 5), invite peers, and select approved topics.
3. **Mentorship & Tracking**: Faculty mentors evaluate group progress, grade milestones, and provide final assessments.
4. **Administration**: Admins manage users, generate Excel reports, and oversee system settings (including database backups/resets).

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
  - `routes.ts`: Centralized API endpoints and route handlers.
  - `db.ts`: Database connection and startup connectivity validation.
  - `db-storage.ts`: Database interaction layer using Drizzle ORM (repository pattern).
- `shared/`: Types and schemas shared between client and server.
  - `schema.ts`: Core Drizzle tables, Zod schemas, and TypeScript interfaces.
- `scripts/`: DB seeding, backup, restore, and reset scripts.

---

## 4. Database Schema (drizzle)
The application relies on several core tables defined in `shared/schema.ts`:
- **users**: Stores all accounts with role-based access (`admin`, `coordinator`, `teacher`, `student`).
- **student_groups**: Student project groups containing `facultyId`, `maxSize`, and `createdById`.
- **student_group_members**: Manages group memberships and invitation statuses.
- **project_topics**: Topics proposed by teachers with a `status` (pending/approved/rejected).
- **student_projects**: Maps groups/students to topics with progress tracking.
- **project_assessments**: Grades and feedback provided by faculty.
- **project_milestones**: Distinct checkpoints for student projects.
- **notifications**: In-app notifications for users.
- **sessions**: Session storage for `express-session`.

---

## 5. Architectural Patterns & Guidelines
1. **API Communication**: The frontend uses TanStack Query (`@tanstack/react-query`) for data fetching, caching, and state synchronization with the Express backend.
2. **Routing**: The application uses `wouter` for lightweight client-side routing.
3. **Styling**: Tailwind CSS is used extensively alongside Radix UI primitives encapsulated in `shadcn/ui` components.
4. **Form Handling & Validation**: `react-hook-form` is used in combination with `@hookform/resolvers/zod`. Zod schemas defined in `shared/schema.ts` act as the single source of truth for both frontend form validation and backend request validation.
5. **Database Queries**: All database interactions should go through the Drizzle ORM. Raw SQL is discouraged. Data access logic is encapsulated in `server/db-storage.ts`. Soft deletes are implemented via the `isDeleted` column across major tables, so queries must filter `eq(table.isDeleted, false)`.

---

## 6. Access Control (RBAC)
- **Student**: Can browse topics, form groups, invite members, submit milestones.
- **Teacher**: Can propose topics, evaluate assigned groups, and grade milestones.
- **Coordinator**: Can approve/reject topic proposals, oversee all projects, view department stats.
- **Admin**: Has full access, can perform destructive actions (DB resets) and manage all users.

