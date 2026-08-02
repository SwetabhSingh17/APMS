<p align="center">
  <h1 align="center">🎓 APMS (Academic Project Management System)</h1>
  <p align="center">
    A comprehensive project management system for educational institutions — streamlining project topic approval, student group formation, faculty mentoring, and progress tracking.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-C5F74F?logo=drizzle&logoColor=black" alt="Drizzle" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## ✨ Key Features

- **Role-Based Access Control** — Four distinct roles: Admin, Coordinator, Teacher, Student  
- **Project Topic Workflow** — Teachers submit topics → Coordinators approve/reject → Students select  
- **Student Group Management** — Create groups, invite members, assign faculty mentors  
- **Progress Tracking** — Real-time dashboards with charts and department statistics  
- **Project Assessments** — Faculty grading with score and feedback  
- **User Management** — Admin panel for bulk user operations, role changes, password resets  
- **System Management** — Database export/import, Excel reports, full reset capabilities  
- **Security Hardened** — Helmet HTTP headers, rate-limited auth endpoints, soft-delete data retention  
- **Error Resilient** — Global React Error Boundaries with graceful fallback UI  
- **Dark/Light Theme** — System-aware with manual toggle  
- **Responsive Design** — Mobile-friendly layouts with collapsible sidebar  

---

## 📊 System Architecture & Workflow

The following graph outlines how different users interact within the APMS ecosystem, from topic creation to final grading:

```mermaid
graph TD
    %% Styling
    classDef default fill:#111,stroke:#333,stroke-width:2px,color:#fff;
    classDef user fill:#0369a1,stroke:#bae6fd,stroke-width:2px,color:#fff;
    classDef core fill:#047857,stroke:#6ee7b7,stroke-width:2px,color:#fff;
    classDef output fill:#be185d,stroke:#fbcfe8,stroke-width:2px,color:#fff;

    %% Nodes
    A[Student]:::user -->|Submit Topic| B(Topic Proposal)
    A -->|Form Group| C(Student Group)
    
    D[Teacher]:::user -->|Evaluate| E(Project Milestone)
    D -->|Grade| F[Final Assessment]:::output
    
    G[Coordinator/Admin]:::user -->|Approve| B
    G -->|Monitor| H(Progress Tracking)
    
    B -->|Verified| I{Core Database}:::core
    C -->|Registered| I
    E -->|Logged| I
    I --> H
    H --> F
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, wouter (routing), TanStack Query, Framer Motion |
| **UI Components** | shadcn/ui (Radix UI primitives), TailwindCSS, Recharts |
| **Backend** | Express.js, Node.js |
| **Authentication** | Passport.js (Local Strategy), express-session |
| **Database** | PostgreSQL, Drizzle ORM |
| **Validation** | Zod, drizzle-zod |
| **Language** | TypeScript (end-to-end) |

---

## 📁 Project Structure

```
APMS/
├── client/                 # Frontend SPA
│   ├── src/
│   │   ├── pages/          # 15 route pages (auth, dashboard, projects, etc.)
│   │   ├── components/     # UI components (shadcn/ui + custom)
│   │   │   ├── ui/         # 48 shadcn/ui primitives
│   │   │   ├── layout/     # MainLayout, Sidebar, Header
│   │   │   └── dashboard/  # Dashboard-specific components
│   │   ├── hooks/          # useAuth, useToast, useMobile
│   │   └── lib/            # QueryClient, utils, ProtectedRoute
│   └── index.html
├── server/                 # Backend API
│   ├── routes/             # Modular API routes (auth, users, projects, etc.)
│   ├── index.ts            # Express app entry point & route aggregation
│   ├── auth.ts             # Passport.js auth setup (RBAC)
│   ├── storage/            # IStorage interface + Drizzle implementation
│   ├── db.ts               # Database connection & migrations
│   └── vite.ts             # Vite dev server integration
├── shared/                 # Shared code
│   └── schema.ts           # Drizzle table definitions + Zod schemas + TypeScript types
├── scripts/                # Database utilities
│   ├── backup_schema.ts    # Schema backup
│   ├── restore_schema.ts   # Schema restore
│   ├── hard_reset.ts       # Full database reset
│   └── seed_test_data.ts   # Test data seeding
├── migrations/             # Drizzle-generated SQL migrations
├── database/               # DB init scripts & backups
└── Setup_Assistant/        # Cross-platform installation scripts
```

---

## 🚀 Getting Started

### Quick Start (Recommended)

For the simplest setup experience, run the included initialization script. It will automatically install dependencies, check your environment, sync the database, and start the development server:

```bash
# Make the script executable (mac/linux)
chmod +x start.sh
# Run the setup script
./start.sh
```

### Manual Installation

If you prefer to run the steps manually:

1. **Clone the repository**
   ```bash
   git clone https://github.com/SwetabhSingh17/APMS.git
   cd APMS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy the example environment file and update it with your credentials:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your PostgreSQL connection string and a secure session secret. See [Configuration](#-configuration) for details.

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:3000`.

---

## ⚙️ Configuration

All configuration is managed through environment variables in a `.env` file at the project root.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/integral_hub` |
| `SESSION_SECRET` | ✅ | Secret key for session encryption | A long random string |
| `PORT` | ❌ | Server port (default: `3000`) | `3000` |
| `NODE_ENV` | ❌ | Environment mode | `development` / `production` |

> **Note:** See `.env.example` for a ready-to-use template.

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Vite HMR + Express) |
| `npm run build` | Build for production (client + server) |
| `npm start` | Start production server |
| `npm run check` | Run TypeScript type checking |
| `npm run db:push` | Push schema changes to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:backup` | Backup database schema and data |
| `npm run db:restore` | Restore database from backup |
| `npm run db:hard-reset` | ⚠️ Full database reset (destructive) |

---

## 👥 User Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full system access, user management, database operations, Excel reports |
| **Coordinator** | Approve/reject topics, track progress, manage users, view statistics |
| **Teacher** | Submit project topics, evaluate assigned projects, view student progress |
| **Student** | Browse & select topics, form groups, invite members, track own progress |

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🤖 AI Context & Future Fixes

- **AI Context**: A dedicated context file (`AI_CONTEXT.md`) provides LLMs and AI assistants with a comprehensive overview of the architecture, stack, and workflows. This file is ignored by git to keep it restricted to local workspace use.
- **Fixes Required**: A list of architectural, security, and maintenance suggestions is maintained in `Fixes_required.md`. Contributors can refer to it for planned refactoring.
