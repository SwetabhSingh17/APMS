# Version History

## Version 1.5.0 (Current)
### Cybertruck Spatial UI Enhancements
1. **Spatial / Glassmorphic UI**: Overhauled the design system with dynamic backdrop filters, glassmorphism, and fluid micro-animations for a modern Spatial OS feel.
2. **Animated Auth Splash Screens**: Added professional, cinematic splash screens (e.g., "WELCOME_ [USERNAME]") that intercept login and logout events with a 2.5s delay.
3. **Dynamic Context Pill**: Replaced traditional bottom-toast notifications with a floating, iOS Dynamic Island-inspired context pill at the top of the UI that expands to display incoming notifications and global toasts.
4. **Holographic Data Grids**: Upgraded standard data tables to holographic grids featuring perspective tilting via Framer Motion 3D transforms when hovered.
5. **Physics-Based Micro-Interactions**: Integrated advanced physics-based spring animations for button presses, hover states, and modal interactions to make the interface feel heavy and responsive.

## Version 1.4.1
### MCA Topic Selection Workflow
1. **Dynamic Workflows by Course**: Introduced distinct topic selection workflows for BCA and MCA students.
2. **MCA Student Suggestions**: MCA students can now propose multiple topics directly to their assigned supervisor.
3. **Supervisor Endorsement**: Supervisors have a dedicated "Student Suggestions" tab to review, endorse, or reject topics proposed by their MCA students.
4. **Auto-Project Assignment**: When a Coordinator or Admin approves an endorsed MCA topic, the system automatically transitions the project status to active, assigning it to the student.
5. **Real-Time Notifications**: Integrated WebSocket notifications to instantly alert supervisors of new student suggestions, and students of endorsement/approval decisions.

### Performance & Accessibility Enhancements
1. **API Response Caching**: Added cache headers for read-heavy endpoints to reduce database queries.
2. **Accessibility Audit**: Ensured proper ARIA labels, keyboard navigation, and WCAG compliance across the application.

### Bug Fixes
1. **Frontend Array Mapping Crash**: Fixed a bug where `.map is not a function` errors would crash frontend tables (`/projects`, `/manage-project`, `/track-progress`, `/user-management`, etc.) because the components expected a raw array but received a `PaginatedResponse` object due to the server-side pagination enhancements in v1.4.0.
2. **Build Configuration Fix**: Corrected a dependency mismatch in `vite.config.ts` where `react-router-dom` was mistakenly referenced in `manualChunks` instead of `wouter`, which caused the production build to fail.

### Documentation
1. **Fixes Required Update**: Expanded the `Fixes_required.md` with new architectural and feature proposals, including Background Jobs, Advanced Rate Limiting, OpenAPI generation, Multi-Department Support, and PDF generation. Numbering anomalies in the document were also resolved.

## Version 1.3.0
### Course Segregation (BCA / MCA)
1. **Schema Update**: Added mandatory `course` field (BCA or MCA) to `users` (Student roles) and `project_topics` schema.
2. **Context-Aware Filtering**: Built a global `CourseFilterContext` accessible via a UI dropdown switch for Admins, Coordinators, and Supervisors to toggle the entire application view between BCA and MCA context.
3. **Strict Student Isolation**: The backend ensures that a BCA student only sees BCA-specific project topics and can only group with BCA students. The same strict isolation applies to MCA students.
4. **UI Indicators**: Added prominent Course Badges to User Management, Approve Topics, Dashboard tables, Manage Projects, and Track Progress pages to ensure clear attribution.
5. **Registration Constraint**: Account creation (signup and admin manual creation) now strictly enforces the selection of a course for Student roles.

### Project Team Management
1. **Terminology Update**: Renamed "Group" to "Project Team" across the entire application for consistency.
2. **Team Creation Constraints**: Implemented strict backend constraints ensuring BCA student teams must have 2 to 5 members and MCA student teams must have 1 to 2 members. Students can only team up with members in their own course.
3. **Special Management Provision**: Admins and Coordinators are granted the exclusive ability to form a BCA team with a single student (size of 1).
4. **Member Search & Editing**: Provided Admins and Coordinators with a powerful autocomplete member search and the ability to add, edit, or remove members in a team from the `/manage-project` page. Supervisors can edit members exclusively for teams they supervise.
5. **Team Edit Notifications**: Integrated automated real-time notifications to Admins, Coordinators, and the relevant Supervisor whenever a team's members are modified.

## Version 1.2.0
### Manual Supervisor Allotment & Manage Project
1. **Manage Project Page**: New dedicated page (`/manage-project`) for Admins and Coordinators to view all project teams, their members, and assigned supervisors in one place.
2. **Manual Supervisor Reassignment**: Admins and Coordinators can now seamlessly change the supervisor assigned to any project team via a "Change Supervisor" dialog with a searchable dropdown.
3. **Notification on Reassignment**: When a supervisor is changed, both the newly assigned and previously assigned supervisors receive real-time notifications.
4. **Sidebar Navigation Update**: "Manage Project" link added under Main Navigation for Admin and Coordinator roles, with a `FolderCog` icon.
5. **Backend APIs**: Added `GET /api/student-project teams` (list all project teams with members/supervisor) and `PATCH /api/student-project teams/:groupId/supervisor` (change supervisor allotment), both restricted to Admin/Coordinator roles.
6. **Storage Layer**: Added `getAllStudentGroups()` and `updateStudentGroupSupervisor()` methods to `db-storage.ts`.

## Version 1.1.2
### Notifications & UI
1. **Real-Time Notifications**: Integrated WebSocket server for instant, zero-polling popups when assignments, approvals, or account modifications occur.
2. **Notification Routing Rules**: Advanced logic applied so only relevant stakeholders receive notifications (e.g. students don't see topic approvals; admins see coordinator modifications).
3. **Interactive Dashboard Widgets**: Dashboard StatsCards are now clickable, routing users directly to respective detail pages with hover animations.
4. **Windows Server Setup**: Created `start_server.bat` for one-click production deployments on Windows Servers.
5. **UI & Theming Revamp**: Overhauled the color palette to ensure AAA high-contrast standards for users with poor eyesight. Removed the `shadcn-theme-json` plugin and manually implemented a unified slate-based color scheme across both Light and Dark themes to ensure perfect visual consistency.
6. **Terminology Refactoring**: System-wide renaming of "Faculty" and "Teacher" keywords to "Supervisor" to align with project management conventions. All roles, database columns, and frontend UI components now consistently use "Supervisor".

## Version 1.1.1

### Bug Fixes & Stability
1. **Migration Pipeline**: Removed the broken file-based migrator in `server/db.ts` that caused startup crashes when `migrations/_journal.json` was missing.
2. Standardized database schema synchronization on `drizzle-kit push` (`npm run db:push`).
3. Added a startup database connectivity check (`SELECT 1`) to ensure the PostgreSQL instance is reachable before serving traffic.

## Version 1.1.0
### Security Enhancements
1. Added `helmet` middleware for robust HTTP security headers (HSTS, X-Frame-Options, CSP, etc.)
2. Implemented `express-rate-limit` on `/api/login` and `/api/register` (5 req / 15 min per IP)

### Database & ORM
1. Implemented soft deletes on `users` and `project_topics` tables via `is_deleted` boolean column
2. `deleteUser()` and `deleteProjectTopic()` now perform UPDATE instead of DELETE
3. All query methods filter out soft-deleted records automatically

### Frontend Architecture
1. Created global `ErrorBoundary` component wrapping the entire app — unhandled errors now show a styled fallback UI instead of a white screen
2. Added optimistic UI updates to Topic Approval page (approve/reject) using TanStack Query `onMutate` with automatic rollback on failure

### Documentation
1. Updated `Fixes_required.md` with completed items and 20+ new improvement suggestions across 7 categories

## Version 1.0.1

### Database Schema Updates
1. Fixed duplicate users table definition in `shared/schema.ts`
2. Added proper foreign key references between tables
3. Updated schema types and relationships
4. Implemented proper table constraints and relationships

### Storage Layer Improvements
1. Replaced raw SQL queries with Drizzle ORM query builder in `server/storage/index.ts`
2. Updated storage functions to use proper table references
3. Implemented type-safe queries using Drizzle
4. Added proper error handling and return types

### UI/UX Enhancements
1. Updated Project Teams page layout and styling
   - Added MainLayout component integration
   - Improved card styling and consistency
   - Enhanced form layouts and input handling
   - Added proper loading states and error handling
   - Implemented proper spacing and typography

2. Added Project Team Information Feature
   - Implemented "Team Info" button for users not in project teams
   - Added dialog showing available project teams
   - Included detailed group information display:
     * Group name and description
     * Member count
     * Current members with profile pictures
     * Full names and enrollment numbers
     * Project mentor details

### General Improvements
1. Enhanced error handling across the application
2. Improved type safety with TypeScript
3. Updated component styling for consistency
4. Added proper loading states throughout the application

## Planned Features
1. Enhanced group collaboration tools
2. Advanced project tracking features
3. Email notification integration
4. File upload support for milestones
5. Audit log for admin operations

## Known Issues
- None reported in current version

## Dependencies
- Node.js (v18 or higher)
- PostgreSQL
- Yarn package manager
- React + Vite
- Drizzle ORM
- Express.js
- TypeScript
- Tailwind CSS
