# Version History

## Version 1.9.5 (Current)
### Default Password Reset, Route Consolidation, Institutional Branding & Registration Lock
1. **One-Click Default Password Reset for Admins & Coordinators (`/user-management`)** —
   - Added a dedicated "Reset Password to Default" button for Admins and Coordinators across All Users, Students, and Supervisors tables, as well as inside the Edit User dialog (`POST /api/admin/users/:id/reset-password`).
   - Dynamically determines the official default credential based on user role:
     - **Students**: Resets password to their university `enrollmentNumber`.
     - **Supervisors**: Resets password to their university Employee ID (`empId`).
   - Automatically sets `forcePasswordReset: true` in the database so that the user is intercepted on their next login and prompted with a mandatory reset dialog to configure a new password.
   - Implemented strict RBAC protection: Coordinators are strictly prevented from resetting Admin or Coordinator passwords (`FORBIDDEN_TARGET_STAFF`).
   - Automatically dispatches a system audit notification to all Administrators whenever a Coordinator executes a default password reset.
2. **Authentication Route Shadowing & Route Consolidation** —
   - Consolidated all `/api/admin/users` routes (`POST`, `PATCH`, `DELETE`) into `server/routes/admin.ts`.
   - Removed duplicate, shadowed route registrations from `server/auth.ts`, fixing the issue where Coordinators received `403 Forbidden` when attempting to edit users or reset passwords.
3. **Cryptographic Password Hashing & Automatic Scrypt Upgrade Migration** —
   - Added password hashing (`await hashPassword()`) and validation (min 6 characters) in `PATCH /api/admin/users/:id` to ensure no passwords can be saved in plaintext.
   - Updated `comparePasswords()` in `server/auth.ts` to gracefully evaluate both scrypt hashes and legacy plaintext records without throwing undefined-salt exceptions.
   - Integrated automatic security migration in `LocalStrategy`: when a user with a legacy plaintext password logs in, their password is automatically upgraded in-place to an scrypt hash in PostgreSQL.
4. **Granular Machine-Readable Error Codes & UI Diagnostic Telemetry** —
   - Introduced standardized, machine-readable error codes across backend endpoints and frontend hooks (`USER_NOT_FOUND`, `INVALID_PASSWORD`, `ACCOUNT_DEACTIVATED`, `AUTH_INTERNAL_ERROR`, `SESSION_CREATION_FAILED`, `FORBIDDEN_TARGET_STAFF`, etc.).
   - Enhanced `client/src/lib/queryClient.ts` with custom `ApiError` class extracting structured error codes from JSON responses.
   - Enhanced `client/src/pages/auth-page.tsx` with high-contrast diagnostic error banners and alert badges for faster student troubleshooting.
5. **Institutional Branding & Layout Refinement on Login Page** —
   - Added the official `Department_Logo.png` in a responsive framed container above the login card.
   - Updated the portal header typography to official university standards:
     - `(I.U.A.P.M.P)`
     - `Integral University Academic Project Management Portal`
     - `Department of Computer Application`
     - `INTEGRAL UNIVERSITY`
   - Added institutional footer attributions:
     - `❤️ Powered By : Binary Battalion.ai ❤️`
     - `💻 Designed and Developed by : SWETABH SINGH 💻`
   - Refined badge and typography sizing across mobile and desktop viewports.
6. **Registration Closed Layover & Guard** —
   - Implemented an aesthetic overlay over the Register tab on the login screen stating: `"Registrations are closed as of now, Teams have already been allotted."`.
   - Displays a warning toast informing students that cohorts and accounts have already been provisioned if the Register tab is clicked.
   - Controlled via frontend flag (`IS_REGISTRATION_OPEN = false`), keeping the backend registration pipeline intact for future academic cycles.

## Version 1.9.4
### Supervisor Search Bar in Admin & Coordinator Change Supervisor Dialog
1. **Searchable Supervisor Directory in Change Supervisor Modal (`/manage-project`)** —
   - Added a real-time name and department search bar to the Change Supervisor dialog accessible by Admin and Coordinator accounts.
   - Enables instant filtering across 60+ faculty supervisors by full name, prefix (Dr., Prof., Mr., Ms.), first name, last name, department, designation, and email address.
   - Refactored the UI from individual nested card dialogs to a single unified modal with:
     - Prominent search input with leading search icon, instant `autoFocus`, and one-click clear button (`✕`).
     - "Currently Assigned" supervisor banner displaying the team's active supervisor with title and department.
     - Live count badge showing the number of available faculty matching the query.
     - Scrollable supervisor directory list with initials avatar, full name with prefix, "Current" badge indicator, and department/email.
     - Visual active selection state with high-contrast primary border and checkmark (`Check`) icon.
     - Friendly empty state when no supervisors match the search term.
     - Full keyboard accessibility (`role="button"`, `tabIndex={0}`, Enter / Space key selection).
     - Save Changes button disabled when the selected supervisor is already the currently assigned supervisor.

## Version 1.9.3
### Supervisor Project View Overhaul, Student Confirmation Dialog & Manage Project Tabs
1. **Supervisor Projects Overhaul (`/projects`)** —
   - Replaced general topic catalog tabs with an exclusive, dedicated "My Topics & Teams" view for supervisor accounts.
   - Each topic displays real-time allotment status (`Picked` vs `Available`), PUGID code, course, complexity, and technology stack.
   - For picked topics, displays full team details: project team ID, group name, completion progress bar, and member roster with enrollment numbers.
   - Added live summary stat cards (Total Topics, Picked by Teams, Still Available) and topic proposal modal integration.
   - Implemented backend endpoint `GET /api/projects/supervisor/my-topics` in `server/routes/projects.ts` and `getSupervisorTopicsWithTeams` in `server/db-storage.ts`.
2. **Student Topic Confirmation Modal (`/student-topics`)** —
   - Added an `AlertDialog` confirmation dialog before BCA students can finalize selecting a topic.
   - Clearly alerts students to the selected project title, that the topic will be assigned to their entire project team, that the action is irreversible, and to contact their department coordinator for issues.
3. **Manage Project Section Tabs for Admin & Coordinator (`/manage-project`)** —
   - Added two dedicated tabs to categorize project teams:
     - **Pending**: Teams that have not yet selected a project topic (`!group.project`), with live count badge and amber `Clock` icon. Set as default tab.
     - **Assigned**: Teams that have selected and been allotted a project topic (`!!group.project`), with live count badge and green `CheckCircle2` icon.
   - Comprehensive search filter covering team names, descriptions, project team IDs, topic titles, topic codes, supervisor names, and student names/enrollment numbers across both tabs.

## Version 1.9.2
### Windows Server Batch Startup Script Fix
1. **Resolved CMD Instant Close on Step 5** — Fixed a fatal syntax parsing error in `start_server.bat` caused by unescaped parentheses within nested batch `if` blocks during the Windows Firewall configuration check. Refactored Step 5 to use clean label-based jumps and safe rule naming (`APMS Server Port 3000`).

## Version 1.9.1
### Windows Server Loading Loop & LAN Remote Access Fixes
1. **Intranet/LAN HTTP Header Calibration (Helmet)** —
   - Disabled automatic HSTS (`Strict-Transport-Security`) and CSP `upgrade-insecure-requests` on HTTP deployments.
   - Resolved the infinite circular loading animation on Windows server caused by browsers upgrading subresources (`/api/user`, dynamic Vite chunks, WebSockets) to HTTPS on a plain HTTP port.
   - Configured `crossOriginResourcePolicy: { policy: "cross-origin" }` to enable remote LAN PCs to load static assets without cross-origin blocking.
2. **Explicit Network Interface Binding (`0.0.0.0`)** —
   - Updated `server.listen(Number(port), "0.0.0.0")` in `server/index.ts` to ensure binding to all IPv4 network adapters on Windows, resolving inaccessible endpoints from remote LAN devices (`http://192.168.6.11:3000`).
3. **Automated Windows Defender Firewall Configuration (`start_server.bat`)** —
   - Added automated verification and Inbound Rule creation for TCP Port 3000 in `start_server.bat` (`netsh advfirewall firewall add rule name="APMS Server (Port 3000)" dir=in action=allow protocol=TCP localport=3000`).
   - Added clear console access indicators displaying local (`http://localhost:3000`) and LAN IP (`http://192.168.6.11:3000`) access URLs.
4. **Database & Session Store Connection Hardening** —
   - Normalized database host to `127.0.0.1` across `server/db.ts` and `winenv`, preventing Node 18+ on Windows from stalling on IPv6 `::1` DNS resolution.
   - Added `connectionTimeoutMillis: 5000` to `pg.Pool` and error handlers on `pool` and `sessionStore` to fail fast and prevent silent request hanging.
5. **Client Request Timeouts & Cleanup** —
   - Added 15-second `AbortSignal` timeouts to `apiRequest` and `getQueryFn` in `client/src/lib/queryClient.ts` to prevent UI hanging on dropped network packets.
   - Removed obsolete third-party script `<script src="https://replit.com/public/js/replit-dev-banner.js"></script>` from `client/index.html`.

## Version 1.9.0
### Student Experience Overhaul, Admin/Coordinator Progress Visibility & Supervisor Attribution
1. **Student Account Project Isolation (`/projects`)** — Bypassed supervisor/admin `<Tabs>` and catalog exploration for student users. The page directly renders an isolated, focused dashboard for the team's selected project with academic milestone progress (5 phases), supervisor contact card, and team roster. When unassigned, displays an informative empty state pointing to topic discovery.
2. **Dual Topic Catalog Visibility (`/student-topics`)** — Students can now view and search both available and unavailable (taken) topics with distinct colored status badges, live keyword search, and dedicated filter tabs (`All Topics`, `Available`, `Unavailable`).
3. **Expandable Topic Cards** — Topic cards now feature smooth interactive expansion on click and a dedicated "Read full description" / "Show less" toggle, eliminating description truncation and preserving line breaks.
4. **Supervisor Honorific / Prefix Display** — Added `prefix` (Dr., Mr., Mrs., Ms., Prof.) to supervisor projections across all student team views, project dashboards, and user management.
5. **Admin & Coordinator Selected Project & Progress Tracking Overhaul** —
   - Changed default landing tab on `/projects` to `Student Projects` table for Admin and Coordinator accounts.
   - Refactored `/track-progress` with authenticated `apiRequest` and `limit=all` to render an 8-column table with student names, enrollment numbers, PUGID codes, topic titles, and supervisors with prefix and academic department.
   - Enhanced `Manage Projects` (`/manage-project`) so each team card displays their selected project badge, topic title, status, and supervisor honorific prefix.
   - Unified supervisor resolution in `server/db-storage.ts` (`getAllProjects`, `getPaginatedProjects`, `getAllStudentGroups`) across both assigned group supervisors and topic submitters.
6. **Query Cache Optimization & Test Sandbox Isolation** —
   - Added `queryClient.clear()` on login and set `staleTime: 5000ms` in `queryClient.ts` to prevent stale caches across user sessions and tab transitions.
   - Scoped test cleanups in `scripts/verify_priority_bug_fixes.ts` and `scripts/verify_bulk_topic_onboarding.ts` to prevent indiscriminate deletion of student projects in the database.

## Version 1.8.1
### Excel-Based Bulk Project Topic Upload, Supervisor Cross-Checking & Sequential PUGID Generation
1. **Verbatim File Parsing & Multi-Topic Extraction** — Implemented `server/services/topic-onboarding-parser.ts` configured specifically to parse `"BCA Final Project Suggestions 2026-27 (Responses).xlsx"`:
   - Accurately parses timestamp, faculty Name, and faculty Email from columns 0-2.
   - Extracts up to 5 submitted project topics per row across 20 topic columns (Title, Project Type, Technology, Description).
   - Intelligently trims inputs and applies safe fallbacks for optional fields (e.g. Technology defaulting to "General / Web Development") to comply with PostgreSQL schema constraints.
2. **Database Cross-Checking & Supervisor Account Validation** —
   - Implemented in `server/db-storage.ts` (`bulkUploadProjectTopics`): queries the PostgreSQL `users` table to verify that the extracted faculty Name and Email match an existing supervisor account.
   - Utilizes token-based name normalization and synonym mapping (handling honorifics like Dr., Prof., and variations such as "Mohammad" vs "Mohd." / "Nafees Akhter" vs "Nafees Akhtar") while strictly detecting true name mismatches (e.g., "John Doe").
   - If a faculty Name or Email fails validation, topics for that row are strictly skipped and not written to PostgreSQL.
3. **Auto-Incrementing Sequential Unique IDs (`PUGID26xxx`)** —
   - Added `topicCode: text("topic_code")` to `projectTopics` table in `shared/schema.ts` with `topic_code_idx` index.
   - Sequential topic ID generator dynamically queries current max sequence for `PUGID26%` in PostgreSQL and generates sequential IDs: `PUGID26001`, `PUGID26002`, `PUGID26003`, up to `PUGID26305`.
   - Topics inserted via bulk onboarding are immediately set to `status = 'approved'` and attributed to the verified supervisor's account ID.
4. **Post-Upload Failure & Success Reporting Modal** —
   - Built `client/src/components/admin/topic-bulk-onboarding-modal.tsx` with drag-and-drop file upload, course selector (BCA/MCA), and "Download Demo Format" button.
   - Post-upload report dynamically renders:
     - Metric cards: Verified Supervisors, Topics Provisioned, Unmatched Records, and Generated PUGID Range.
     - Dedicated Failure Report table displaying Row Number, Faculty Name, Faculty Email, and exact failure reason badge (e.g., `"Upload Failed: Supervisor email not found in database"` or `"Upload Failed: Supervisor name does not match record for this email"`).
     - Success Report table listing each verified faculty member and their assigned sequential PUGID topic codes.
5. **UI Badging & Topic Code Visibility** —
   - Added `topic.topicCode` badge (`PUGID26xxx`) to `client/src/pages/approve-topics.tsx` in Pending, Approved, and Rejected tabs.
   - Added `topic.topicCode` badge to `TopicCard` in `client/src/pages/topics.tsx` and `client/src/pages/student-topics.tsx`.
   - Added "Bulk Upload Topics" button to the Topic Approval toolbar.
6. **Demo Format Excel Generator** —
   - Implemented `GET /api/admin/onboarding/topics/demo-template` generating a downloadable Excel template matching the exact 23-column layout of the Google Forms responses spreadsheet.
7. **Comprehensive Automated Verification Suite** —
   - Created `scripts/verify_bulk_topic_onboarding.ts` with 57 automated test assertions verifying: verbatim parsing of 61 rows / 305 topics, demo template generation, supervisor cross-checking, error simulation with unmatched email and name, sequential `PUGID26xxx` code generation, and complete ingestion.
   - Full test suite (`npm test`) now validates 120 total test assertions across all modules with 100% success rate.

## Version 1.8.0
### Supervisor Bulk Onboarding, Faculty Directory & Multi-Course Access Control
1. **Dedicated Supervisor Bulk Onboarding Workflow** — Created a completely isolated onboarding module specifically for faculty supervisors:
   - Dedicated backend parser (`server/services/supervisor-onboarding-parser.ts`) supporting both legacy BIFF8 binary `.xls` (e.g. `Updated Staff List with all details.xls`) and modern `.xlsx`.
   - Automatically extracts `Emp. ID.`, `Employee Name` (with prefix separation: Dr., Mr., Mrs., Ms., Prof.), `Designation`, `Mobile`, `Official Email`, and Department title banner.
   - Separate API route `POST /api/admin/onboarding/supervisor/upload` with optional SSE real-time streaming telemetry.
   - In-memory optimized batch upsert in `server/db-storage.ts` (`bulkOnboardSupervisors`), auto-provisioning supervisor accounts with `username = empId`, initial temporary password = `empId` (scrypt hashed), `role = supervisor`, and `forcePasswordReset = true`.
2. **Multi-Course Supervisor Availability (BCA & MCA)** —
   - Updated `getAllUsers` and `getPaginatedUsers` in `server/db-storage.ts` so that supervisors, coordinators, and administrators remain visible and accessible when filtering by `BCA` or `MCA`, recognizing that faculty supervisors advise both BCA and MCA students.
   - Strict student cohort isolation is simultaneously preserved (BCA student queries never leak MCA students, and vice versa).
3. **User Management Interface Streamlining** —
   - Removed the redundant roles dropdown next to the search bar in `client/src/pages/user-management.tsx`.
   - Role filtering is now cleanly handled exclusively by the interactive visual tabs: `All Users`, `Admins`, `Supervisors`, `Coordinators`, and `Students`.
   - Expanded search input across the full card width for an uncluttered, modern layout.
4. **Strict UI Separation for Student & Supervisor Workflows** —
   - Rendered two distinct, prominent buttons in User Management: "Bulk Upload Student" and "Bulk Upload Supervisor".
   - Created `SupervisorBulkOnboardingModal` with custom progress bar, file drag-and-drop, live terminal logs, and onboarding summary metrics (Processed, Created, Updated).
5. **Supervisor Demo Template Generator** —
   - Implemented `GET /api/admin/onboarding/supervisor/demo-template` generating a downloadable Excel template matching the exact layout, header banner ("Department of Computer Application"), column styling, and Integral University sample faculty data as the official staff list.
6. **Database Schema & Migration** —
   - Added `emp_id`, `prefix`, `designation`, `mobile`, `department` columns and `emp_id_idx` index to the `users` table in PostgreSQL.
   - Verified non-destructive automatic schema verification in `server/db.ts`.
7. **Universal First-Login Security Enforcement** —
   - Extended the Express security interceptor in `server/auth.ts` to enforce `forcePasswordReset` for all users, requiring newly provisioned supervisors to update their initial password before accessing operational APIs.
   - Updated `ForcePasswordResetModal` to adaptively display "Employee ID" for faculty supervisors and "Enrollment Number" for students.
8. **Profile Settings Interface & RBAC on Designation** —
   - Updated Settings Profile view to visually display academic designation directly below the user's name in a styled badge alongside Employee ID and department.
   - Allowed faculty to mutate their own Name, Prefix, Email, and Mobile.
   - Strictly enforced RBAC: Designation input is disabled for supervisors; attempts to modify designation via `PATCH /api/user/profile` by non-administrators are rejected with HTTP 403 Forbidden.
9. **Automated Verification Suite** — Added `scripts/verify_supervisor_onboarding_and_rbac.ts` covering 44 comprehensive automated test assertions across parsing, template generation, provisioning, security interception, RBAC enforcement, and multi-course supervisor visibility with 100% pass rate (63 total test assertions across the project).

## Version 1.7.2
### Team Access Control & Permission Hardening
1. **Removed "Leave Project Team" Entirely** — Removed the "Leave Project Team" button and confirmation dialog from the student portal (`client/src/pages/student-groups.tsx`). Students in a team can now only view their assigned team, members, and project mentor without any option to leave.
2. **Restricted Team Modifications to Admins & Coordinators** —
   - `PATCH /api/student-groups/:groupId/members` in `server/routes/groups.ts` now strictly enforces `[UserRole.ADMIN, UserRole.COORDINATOR]`. Supervisors are completely blocked from modifying team members.
   - `POST /api/student-groups/:groupId/leave` is now permanently blocked with HTTP 403 Forbidden for students and supervisors.
   - Administrators and Coordinators retain exclusive authority to modify team rosters and reassign supervisors via the Manage Project console.

## Version 1.7.1
### Stability & Bug Fixes
1. **Resolved React Dispatcher Collision (`dispatcher.useMemo`)** — Fixed the `null is not an object (evaluating 'dispatcher.useMemo')` runtime error during bulk upload file submission:
   - Added Vite deduplication (`dedupe: ["react", "react-dom"]`) in `vite.config.ts` to prevent multiple React instance hook collisions.
   - Replaced context-heavy `@radix-ui/react-progress` with a native accessible progress bar in `bulk-onboarding-modal.tsx`.
   - Consolidated 5 discrete streaming state updates into a single atomic `IProgressState` object to eliminate React 18 render queue interleaving during SSE reads.
   - Replaced `@radix-ui/react-switch` with a native accessible toggle.
2. **User Management Full Account Visibility** — Resolved account truncation where User Management only displayed 50 records:
   - Modified `GET /api/users` in `server/routes/admin.ts` to return all accounts via `storage.getAllUsers(course)` when pagination is not requested or when `limit=all` is specified.
   - Updated `client/src/pages/user-management.tsx` with live dynamic count indicators on each tab (`All Users (${allUsersCount})`, `Supervisors (${supervisorsList.length})`, `Students (${studentsList.length})`, `Coordinators (${coordinatorsList.length})`) and clean empty-state rows.
3. **Course Filter Data Isolation (BCA & MCA)** — Fixed issue where selecting "BCA" or "MCA" in the header course filter returned 0 accounts or groups:
   - Updated `storage.getAllUsers(course)` and `getPaginatedUsers` in `server/db-storage.ts` to perform case-insensitive course matching (`UPPER(users.course) = UPPER(course)`) while preserving administrator visibility.
   - Fixed `storage.getAllStudentGroups` to include `course: m.course` in group member projections.
   - Updated `GET /api/student-groups` in `server/routes/groups.ts` to check both group-level course and member-level courses case-insensitively, correctly populating all 157 BCA groups and 2 MCA groups.

## Version 1.7.0
### Bulk Excel Onboarding & Automated Provisioning
1. **Multi-Sheet Excel Parser with ExcelJS** — Added `server/services/onboarding-parser.ts` to parse multi-sheet workbooks. Dynamically detects header rows, handles merged cells (`MergeValue`), extracts hyperlinks (avoiding `[object Object]` crashes), and extracts student details (`Enrollment Number`, `Student Name`, `Project TeamID`, `Mobile No.`, `Email Id`).
2. **Automated Account & Team Provisioning** — Implemented `bulkOnboardStudentsAndTeams` in `server/db-storage.ts`: provisions student accounts (`username = enrollmentNumber`, initial password = enrollment number hashed with scrypt, `forcePasswordReset = true`), automatically forms project teams in `student_groups`, and associates members in `student_group_members`. Optimized with O(1) in-memory maps and concurrent batching, executing 702 student imports in **under 1 second** (a 23x performance improvement).
3. **Real-Time Progress Bar & SSE Telemetry** — Added a real-time progress bar powered by Server-Sent Events (SSE) streaming updates from the server. Features an interactive toggle switch, live status messages, 4-step pipeline indicators, and a collapsible dark-mode live event terminal.
4. **Downloadable Demo Template** — Added `GET /api/admin/onboarding/demo-template` generating a styled multi-sheet Excel file with instructions, sample data, and guidelines with authenticated blob streaming.
5. **Mandatory Course Isolation Modal** — Created `BulkOnboardingModal` enforcing selection of `BCA` vs `MCA` before file processing to guarantee strict cohort isolation. Enforced `credentials: "include"` across all network requests.

### First-Login Security Enforcement
1. **Express Security Interceptor** — Middleware in `server/auth.ts` intercepts authenticated student requests when `forcePasswordReset === true`. Restricts access to `/api/user`, `/api/user/change-password`, and `/api/logout`, returning HTTP 403 `PASSWORD_RESET_REQUIRED` on all other endpoints.
2. **Non-Dismissible Password Reset Dialog** — Global `ForcePasswordResetModal` in React intercepts the session on first login. Validates current password, enforces minimum length of 6 characters, and updates password via `/api/user/change-password` which clears the flag.

### Strict Topic Visibility & Program Isolation
1. **Course-Enforced Topic Visibility** — `GET /api/topics/approved` strictly isolates approved topics based on the student's enrolled course (`BCA` or `MCA`), disabling public caching to prevent cross-course leakage.
2. **Individual Topic Guard** — `GET /api/topics/:id` verifies the topic belongs to the student's program and returns HTTP 403 if attempting to access another course's topic.

### Codebase & Documentation Standardization
1. **Standardized English** — Converted all comments, docstrings, UI labels, toasts, and API messages across the codebase to English.

## Version 1.6.0
### Critical & High Security Fixes
1. **Privilege Escalation Removed** — Deleted the shadow `/auth/register` endpoint that allowed anonymous users to create admin accounts with arbitrary roles. All registration now flows through `/api/register`, which enforces the single-Admin/single-Coordinator rule.
2. **Password Hash Exposure Patched** — `/auth/login` no longer returns the scrypt password hash. The unauthenticated `GET /api/supervisors` endpoint now requires authentication and returns only a safe projection (`id`, `firstName`, `lastName`, `email`).
3. **Progress IDOR Fixed** — `PUT /api/projects/:id/progress` now enforces role-based ownership: project owner (student), topic-proposing supervisor, current group supervisor, or Coordinator/Admin.
4. **WebSocket Identity Spoofing Fixed** — The `/ws` handshake validates the signed `connect.sid` session cookie against the PostgreSQL session store and derives the userId server-side. The client-supplied `?userId=` parameter is ignored; unauthenticated sockets are closed with code 1008.
5. **Dashboard Statistics Guarded** — `GET /api/stats` now requires authentication (previously leaked institution-wide statistics to anonymous callers).

### Functional Fixes
1. **Notification Inbox Now Works End-to-End** — Added `GET /api/notifications`, `PATCH /api/notifications/:id/read` (ownership-enforced), `POST /api/notifications/read-all`, and `DELETE /api/notifications`. The header bell dropdown and `/notifications` page were previously rendering hardcoded mock data; both now use the live API with real-time WebSocket cache invalidation.
2. **Hard Reset = True Fresh Install** — Rewritten as a transactional `TRUNCATE ... RESTART IDENTITY CASCADE`: all ID sequences restart at 1, the default admin is recreated through the canonical seeding path (admin id=1), all WebSocket connections are dropped, the admin's session is destroyed, and the confirmation password is now actually verified server-side. The UI shows an "Export your data first" popup when reset is clicked.
3. **Backup Import Hardened** — Table ID sequences are re-synced past imported `MAX(id)` values after a restore, preventing silent primary-key collisions. Imports no longer terminate the importing admin's session.

### Production Deployment (Windows Server)
1. **One-Click `start_server.bat`** — Fully rewritten: verifies Node.js, bootstraps `.env` from the template on first run, installs dependencies, prepares the database, builds, and starts — with error trapping at every step. (The previous version invoked `npm` without `call`, so it could never chain commands.)
2. **New `npm run db:ensure`** — Production-safe database bootstrap: verifies connectivity with actionable diagnostics, creates the schema + default admin **only if missing**, and safely syncs pending schema changes on updates. Never wipes data (unlike `db:setup`).
3. **Fail-Fast Startup** — `runMigrations()` now verifies all 9 core tables exist before serving traffic. A fresh database previously passed the connectivity-only check and then served `relation "users" does not exist` errors on every request.
4. **Unified Database Configuration** — `DATABASE_URL` is now the single source of truth (parsed by the runtime server, drizzle-kit, and `ensure_db`). The `DB_*` variables work as a fallback style. A conflicting `.env` can no longer point the schema tooling and the server at different databases. `drizzle.config.ts` and `.env.example` updated accordingly.

### Documentation
1. Updated README, Installation Guide, Security Policy, AI Context, and this changelog to reflect v1.6.0 architecture and workflows.

## Version 1.5.0
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
