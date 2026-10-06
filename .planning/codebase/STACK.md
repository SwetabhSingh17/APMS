---
last_mapped_commit: a672e1e53b1e5280fad2d5fdeb2795de95133954
last_mapped_at: 2026-10-06
---
# Technology Stack

**Analysis Date:** 2026-10-06

## Languages

**Primary:**
- TypeScript 5.6.3 - Full-stack application codebase covering both client (`client/src/`) and server (`server/`, `shared/`)
- JavaScript (ESNext / Node.js ESM) - Configuration scripts (`postcss.config.js`, `server/config/database.js`)

**Secondary:**
- SQL (PostgreSQL dialect) - Database migrations, schema initialization, and raw SQL queries (`server/migrations/`, `database/backups/`)
- CSS3 / Tailwind Utility Classes - Frontend user interface styling (`client/src/index.css`)
- Python 3 - Auxiliary test generation helper script (`generate_tests.py`)
- Shell / Batch Scripting - Server launcher and deployment automation (`start_server.bat`, `start-network.sh`, `Setup_Assistant/`)

## Runtime

**Environment:**
- Node.js v20.16.11+ (ESM native, `"type": "module"` in `package.json`)
- tsx 4.19.3 - TypeScript execution engine for server dev runtime and verification scripts

**Package Manager:**
- npm / yarn (project contains `package-lock.json` and `yarn.lock`)
- Lockfile: present (`package-lock.json`, `yarn.lock`)

## Frameworks

**Core:**
- Express 4.21.2 - Backend REST API server and WebSocket routing (`server/index.ts`, `server/routes/`)
- React 18.3.1 - Frontend Single Page Application (`client/src/App.tsx`, `client/src/main.tsx`)
- Drizzle ORM 0.41.0 - Type-safe SQL ORM and schema modeling (`shared/schema.ts`, `server/db.ts`, `server/db-storage.ts`)

**Routing & State Management:**
- Wouter 3.3.5 - Client-side routing engine (`client/src/App.tsx`)
- TanStack React Query 5.60.5 - Async server state management, caching, and optimistic updates (`client/src/lib/queryClient.ts`)

**UI & Component Libraries:**
- Radix UI Primitives - Accessible primitives (`@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, etc.)
- Lucide React 0.453.0 & React Icons 5.4.0 - UI iconography (`client/src/components/`)
- Framer Motion 11.18.2 - Micro-interactions, animated modal transitions, and physics animations
- Three.js 0.185.1 / React Three Fiber 8.18.0 / Drei 9.122.0 - 3D department data visualizer (`client/src/components/dashboard/progress-3d.tsx`)
- Recharts 2.13.0 - Dashboard charts and analytics visualization

**Build/Dev:**
- Vite 6.2.6 - Frontend build tool, dev server, and HMR (`vite.config.ts`)
- esbuild 0.25.0 - Production Node server bundler (`package.json`)
- Drizzle-Kit 0.30.6 - Database schema migration CLI (`drizzle.config.ts`)
- Tailwind CSS 3.4.14 - Utility-first CSS framework (`tailwind.config.ts`, `postcss.config.js`)

## Key Dependencies

**Critical:**
- `postgres` 3.4.5 & `pg` 8.11+ - PostgreSQL client driver and connection pooler (`server/db.ts`)
- `passport` 0.7.0 & `passport-local` 1.0.0 - User session authentication engine (`server/auth.ts`)
- `express-session` 1.18.1 & `connect-pg-simple` 10.0.0 - PostgreSQL-backed session store (`server/auth.ts`, `server/db-storage.ts`)
- `ws` 8.18.0 - Real-time WebSocket notification server (`server/websocket.ts`)
- `zod` 3.23.8 & `drizzle-zod` 0.7.0 - Runtime schema validation and TypeScript type inference (`shared/schema.ts`)
- `exceljs` 4.4.0 & `xlsx` 0.18.5 - Bulk Excel cohort onboarding parsing and demo workbook generation (`server/services/`)

**Infrastructure & Security:**
- `helmet` 8.3.0 - Security HTTP headers (`server/index.ts`)
- `express-rate-limit` 8.6.1 - IP-based endpoint brute-force protection (`server/auth.ts`)
- `multer` 2.4.0 - Multipart in-memory file upload middleware (`server/routes/admin.ts`)
- `crypto` (Node.js built-in) - `scrypt` password hashing, timing-safe equality checks, and HMAC verification (`server/auth.ts`, `server/websocket.ts`)

## Configuration

**Environment:**
- Configured via `.env` loaded with `dotenv` (`server/index.ts`, `server/db.ts`)
- Key configs required:
  - `DATABASE_URL` (or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) - PostgreSQL database connection
  - `SESSION_SECRET` - Cryptographic secret for signing session cookies
  - `PORT` - Application port (default: 3000 in production, 5000 / 5173 in development)
  - `NODE_ENV` - Environment toggle (`development` | `production`)
  - `ENABLE_HSTS` - Optional HSTS toggle (kept false for local/LAN HTTP deployments)

**Build:**
- `tsconfig.json` - Strict TypeScript compiler options with bundler resolution and `@/`, `@shared/` path aliases
- `vite.config.ts` - Vite configuration with React plugin, path aliases, vendor manual chunks (`vendor-react`, `vendor-ui`, `vendor-charts`, `vendor-utils`), and LAN access (`host: true`)
- `tailwind.config.ts` - Theme configurations, typography plugin, and CSS animations
- `drizzle.config.ts` - Drizzle Kit schema mapping pointed to `shared/schema.ts` and PostgreSQL connection resolver

## Platform Requirements

**Development:**
- Node.js v20.x or higher
- PostgreSQL 14+ instance running locally or over LAN
- Modern web browser (Chrome, Edge, Firefox, Safari)

**Production:**
- Node.js runtime on Linux or Windows Server
- PostgreSQL database (standalone, LAN server, Neon, or Vercel Postgres)
- Windows Server supported via automated batch script `start_server.bat` with automatic Windows Defender Firewall TCP port configuration

---

*Stack analysis: 2026-10-06*
