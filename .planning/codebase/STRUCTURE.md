---
last_mapped_commit: a672e1e53b1e5280fad2d5fdeb2795de95133954
last_mapped_at: 2026-10-06
---
# Codebase Structure

**Analysis Date:** 2026-10-06

## Directory Layout

```
IntegralProjectHub/
├── client/                     # Frontend SPA source code (React 18 + Vite)
│   ├── public/                 # Static public assets (logos, avatars, icons)
│   ├── src/                    # React application source
│   │   ├── components/         # Reusable UI & domain-specific components
│   │   │   ├── admin/          # Admin-specific modals (bulk onboarding)
│   │   │   ├── auth/           # Authentication widgets (password reset modal)
│   │   │   ├── dashboard/      # Dashboard cards, activity widgets, 3D visualizer
│   │   │   ├── layout/         # Shell layout (sidebar, header, context pill)
│   │   │   ├── notifications/  # Notification dropdown and item components
│   │   │   ├── projects/       # Topic cards and project table components
│   │   │   └── ui/             # Radix UI and Tailwind design system primitives
│   │   ├── hooks/              # Custom React hooks (auth, toast, mobile, filter)
│   │   ├── lib/                # Client utilities, queryClient, route protection
│   │   ├── pages/              # Top-level page views mapped to routes
│   │   ├── App.tsx             # Main React application router and provider tree
│   │   ├── main.tsx            # Vite DOM entry point
│   │   ├── index.css           # Global stylesheet and Tailwind directives
│   │   └── types.ts            # Frontend-specific type definitions
│   └── index.html              # Single page application HTML template
├── database/                   # Database maintenance assets
│   └── backups/                # SQL backup dumps from backup scripts
├── dist/                       # Production build output directory (generated)
├── scripts/                    # Test suites, database utilities, and verification scripts
├── server/                     # Backend Express server source code
│   ├── config/                 # Auxiliary configuration scripts
│   ├── migrations/             # SQL migration files
│   ├── routes/                 # Express REST API route controllers
│   ├── services/               # Specialized services (Excel onboarding parsers)
│   ├── auth.ts                 # Passport.js authentication and password hashing
│   ├── db.ts                   # PostgreSQL connection and schema verification
│   ├── db-storage.ts           # Drizzle ORM data access layer (DBStorage class)
│   ├── index.ts                # Express server entry point and HTTP bootstrap
│   ├── vite.ts                 # Vite development middleware and static file server
│   └── websocket.ts            # WebSocket server and live notification hub
├── Setup_Assistant/            # Cross-platform installation and setup helper scripts
├── shared/                     # Universal shared definitions between client and server
│   └── schema.ts               # Drizzle table schemas, Zod validators, and types
├── drizzle.config.ts           # Drizzle Kit CLI configuration
├── package.json                # Project dependencies and script definitions
├── start_server.bat            # Windows Server automated launcher script
├── start-network.sh            # Unix / macOS LAN launcher script
├── tailwind.config.ts          # Tailwind CSS theme and styling configuration
├── tsconfig.json               # TypeScript compiler configuration
└── vite.config.ts              # Vite bundler and dev server configuration
```

## Directory Purposes

**`client/src/pages/`:**
- Purpose: Houses all route-level page components loaded by Wouter.
- Contains: Single page views for Dashboard, Projects, Topics, Management consoles, and Settings.
- Key files: `dashboard.tsx`, `projects.tsx`, `student-topics.tsx`, `manage-project.tsx`, `team-management.tsx`, `supervisor-management.tsx`, `user-management.tsx`.

**`client/src/components/`:**
- Purpose: Reusable UI widgets and composite domain components.
- Contains: Layout containers, admin dialogs, topic cards, and Radix UI primitives in `ui/`.
- Key files: `layout/main-layout.tsx`, `layout/sidebar.tsx`, `layout/header.tsx`, `projects/topic-card.tsx`, `admin/bulk-onboarding-modal.tsx`.

**`server/routes/`:**
- Purpose: Houses modular Express routers handling specific REST resource domains.
- Contains: Route handlers for authentication, user administration, project management, group formation, and topics.
- Key files: `routes/admin.ts`, `routes/groups.ts`, `routes/projects.ts`, `routes/topics.ts`, `routes/users.ts`.

**`server/services/`:**
- Purpose: Complex business logic and external file processing.
- Contains: Excel workbook parsers for student cohorts, supervisor rosters, and project suggestions.
- Key files: `services/onboarding-parser.ts`, `services/supervisor-onboarding-parser.ts`, `services/topic-onboarding-parser.ts`.

**`shared/`:**
- Purpose: Single source of truth for database schema definitions, Zod validation schemas, and TypeScript interfaces used by both frontend and backend.
- Contains: `schema.ts`.
- Key files: `shared/schema.ts`.

**`scripts/`:**
- Purpose: Automated regression test suites, database migration utilities, and schema seeding scripts.
- Contains: Standalone TypeScript executable scripts run via `tsx`.
- Key files: `scripts/verify_team_management_and_supervisor_fix.ts`, `scripts/verify_priority_bug_fixes.ts`, `scripts/ensure_db.ts`.

## Key File Locations

**Entry Points:**
- `client/src/main.tsx`: Client-side DOM mounting entry point.
- `server/index.ts`: Server-side HTTP and WebSocket application entry point.

**Configuration:**
- `tsconfig.json`: TypeScript compiler options and path aliases (`@/*`, `@shared/*`).
- `vite.config.ts`: Vite frontend bundling, manual vendor chunks, and LAN server settings.
- `drizzle.config.ts`: Drizzle ORM schema mapping and database connection resolver.
- `tailwind.config.ts`: Tailwind theme colors, typography, and animation configs.

**Core Logic:**
- `server/db-storage.ts`: Central database access layer executing queries and transactional logic.
- `server/auth.ts`: Authentication, scrypt password hashing, and session management.
- `client/src/App.tsx`: Client routing, global context providers, and layout tree.
- `shared/schema.ts`: Database tables and validation rules.

**Testing:**
- `scripts/`: Verification test suites executed via `npm test`.

## Naming Conventions

**Files:**
- React Components & Pages: kebab-case with `.tsx` extension (e.g., `student-topics.tsx`, `topic-card.tsx`, `bulk-onboarding-modal.tsx`).
- React Hooks: kebab-case prefixed with `use-` with `.tsx` or `.ts` extension (e.g., `use-auth.tsx`, `use-notifications.tsx`, `use-toast.ts`).
- Server Modules & Utilities: kebab-case with `.ts` extension (e.g., `db-storage.ts`, `onboarding-parser.ts`, `websocket.ts`).
- Shared Schemas & Definitions: `schema.ts`, `types.ts`.

**Directories:**
- All directories use lowercase kebab-case (e.g., `components`, `layout`, `services`, `routes`, `backups`).

## Where to Add New Code

**New Feature (e.g., Project Evaluation Milestones):**
- Database Schema: Add table definition and Zod schema in `shared/schema.ts`.
- Data Access: Add CRUD query methods to `DBStorage` class in `server/db-storage.ts`.
- Backend Endpoints: Add route handlers in `server/routes/projects.ts` (or create new `server/routes/milestones.ts` and mount in `server/routes/index.ts`).
- Frontend View: Add new page component in `client/src/pages/` and register in `client/src/App.tsx`.
- Tests: Add integration test script in `scripts/verify_new_feature.ts`.

**New Component/Module:**
- Reusable UI primitive: Add to `client/src/components/ui/` following Radix + Tailwind patterns.
- Domain feature widget: Add to appropriate domain folder in `client/src/components/{domain}/` (e.g., `components/projects/`, `components/admin/`).

**Utilities & Helpers:**
- Client Utilities: Add to `client/src/lib/utils.ts`.
- Server Services: Add to `server/services/` for complex file/data processing.

## Special Directories

**`dist/`:**
- Purpose: Contains compiled production assets (backend `dist/index.js` and frontend `dist/public/`).
- Generated: Yes (via `npm run build`).
- Committed: No (ignored by Git).

**`database/backups/`:**
- Purpose: Stores generated SQL database dumps and schema snapshots.
- Generated: Yes (via `npm run db:backup`).
- Committed: Tracked selectively for reference schemas.

**`.planning/`:**
- Purpose: Contains GSD planning artifacts, codebase maps, and project management states.
- Generated: Yes (via GSD commands).
- Committed: Yes.

---

*Structure analysis: 2026-10-06*
