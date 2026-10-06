---
last_mapped_commit: a672e1e53b1e5280fad2d5fdeb2795de95133954
last_mapped_at: 2026-10-06
---
# Coding Conventions

**Analysis Date:** 2026-10-06

## Naming Patterns

**Files:**
- React Components & Pages: kebab-case with `.tsx` extension (`client/src/pages/student-topics.tsx`, `client/src/components/create-team-dialog.tsx`).
- React Hooks: kebab-case prefixed with `use-` with `.tsx` or `.ts` extension (`client/src/hooks/use-auth.tsx`, `client/src/hooks/use-notifications.tsx`).
- Server Modules & Utilities: kebab-case with `.ts` extension (`server/db-storage.ts`, `server/services/onboarding-parser.ts`).
- Verification & Test Scripts: snake_case with `.ts` extension (`scripts/verify_team_management_and_supervisor_fix.ts`).

**Functions:**
- camelCase for all standard functions and methods (`hashPassword`, `comparePasswords`, `getStudentProjects`, `resolveDbConfig`).
- PascalCase for React functional components (`ForcePasswordResetModal`, `MainLayout`, `TopicCard`, `Dashboard`).
- Custom React hooks: camelCase prefixed with `use` (`useAuth`, `useNotifications`, `useToast`, `useMobile`).

**Variables:**
- camelCase for standard local variables, object properties, and parameters (`studentGroup`, `supervisorId`, `enrollmentNumber`).
- UPPER_SNAKE_CASE for compile-time constants, environment defaults, and configuration flags (`IS_REGISTRATION_OPEN`, `DEFAULT_MAX_SIZE`).

**Types & Interfaces:**
- Interfaces must be prefixed with `I` per project guidelines (`IUser`, `IStudentGroup`, `IProjectTopic`, `IOnboardingProgress`, `ISupervisorOnboardingRow`).
- Types inferred from Drizzle ORM schemas use PascalCase without prefix (`User`, `StudentGroup`, `ProjectTopic`, `InsertUser`).
- Enums: PascalCase with UPPER_SNAKE_CASE members (`UserRole.ADMIN`, `CourseType.BCA`, `CollaborationType.GROUP`).

## Code Style

**Formatting:**
- Indentation: 2 spaces.
- Quotes: Double quotes or single quotes with consistent formatting per module.
- Semicolons: Always used.
- Trailing commas: Used in multi-line objects, arrays, and parameter lists.

**Linting & Type Safety:**
- TypeScript Compiler (`tsc`) acts as the primary static quality gate (`npm run check`).
- Strict mode is enabled (`"strict": true` in `tsconfig.json`).
- `skipLibCheck: true` is configured for build speed.

## Import Organization

**Order:**
1. Core runtime & standard libraries (`react`, `express`, `crypto`, `http`).
2. Third-party packages (`wouter`, `@tanstack/react-query`, `lucide-react`, `drizzle-orm`, `zod`).
3. Internal aliases:
   - `@shared/*` schema and types (`@shared/schema`).
   - `@/*` client components, hooks, and libraries (`@/components/ui/button`, `@/hooks/use-auth`).
4. Relative imports (`./db-storage`, `./auth`, `../services/onboarding-parser`).

**Path Aliases:**
- `@/*` mapped to `./client/src/*` for client-side resolution.
- `@shared/*` mapped to `./shared/*` for universal contract resolution.
- `@assets/*` mapped to `./attached_assets` for static design assets.

## Error Handling

**Patterns:**
- **Server Endpoints:** All route handlers wrap asynchronous calls in `try { ... } catch (error) { ... }` blocks. Handlers log errors via `console.error` and return standard JSON error structures (`res.status(500).json({ message: "Failed to perform operation" })`).
- **Client Queries & Mutations:** Uses TanStack Query with the custom `apiRequest()` helper in `client/src/lib/queryClient.ts`. HTTP error responses are parsed into typed `ApiError` instances containing machine-readable error codes (e.g., `USER_NOT_FOUND`, `INVALID_PASSWORD`, `FORBIDDEN_TARGET_STAFF`).
- **User Feedback:** Errors are displayed via the `useToast` hook as destructive toasts or rendered in dedicated error banners (`client/src/pages/auth-page.tsx`).
- **Fatal UI Errors:** The root application tree is wrapped in `client/src/components/ErrorBoundary.tsx` to prevent blank screen crashes.

## Logging

**Framework:**
- Structured request logging middleware in `server/index.ts` intercepting all `/api` traffic.
- Built-in `console.log` / `console.error` / `console.warn` for server lifecycle, database diagnostics, and error reporting.

**Patterns:**
- Prefix logs with recognizable domain tags or emoji indicators (e.g., `⚠️ Could not parse DATABASE_URL`, `✅ Database connected`, `WebSocket connected for user ${userId}`).
- Log operational context alongside error messages without leaking credential secrets or sensitive student PII.

## Comments

**When to Comment:**
- Explain *why*, not just *what*, strictly in English.
- Document institutional business rules (e.g., BCA vs MCA group capacity differences, tentative supervisor nomenclature, single-admin constraints).
- Block-by-block documentation for multi-step algorithmic operations (such as Excel workbook ingestion and SSE progress emissions in `server/services/onboarding-parser.ts`).

**JSDoc/TSDoc:**
- Top-of-file header docstrings describing module purpose, security considerations, and dependencies (see `server/index.ts`, `server/db.ts`, `shared/schema.ts`).
- Function docstrings for reusable helpers and database repository methods.

## Function Design

**Size:**
- Single Responsibility Principle (SRP): Keep functions and React components small and focused.
- Deconstruct complex operations into modular helper functions (e.g., `resolveDbConfig` in `server/db.ts`, `unsignSessionId` in `server/websocket.ts`).

**Parameters:**
- Destructure object parameters with TypeScript typing for clarity.
- Avoid boolean flag arguments where an options object or enum provides clearer intent.

**Return Values:**
- Explicit return types on core utility and repository functions (`Promise<User | undefined>`, `Promise<PaginatedResponse<T>>`).
- Handlers in Express routes explicitly return responses (`return res.json(...)`) to prevent accidental execution fallthrough.

## Module Design

**Exports:**
- Named exports preferred for utilities, schemas, and services (`export function hashPassword`, `export const users = ...`).
- Default exports used for top-level React page components (`client/src/pages/`) to support `React.lazy()` dynamic chunk loading.

**Barrel Files:**
- Used selectively (e.g., `server/routes/index.ts` aggregating and mounting all route sub-modules).

---

*Convention analysis: 2026-10-06*
