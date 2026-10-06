# Roadmap: IntegralProjectHub (APMS)

## Overview

This roadmap defines the next evolution cycle of the Integral University Academic Project Management System (APMS). Starting from the solid foundation of v2.0.1, it hardens data integrity during system backups and restores, implements server-side registration gates and input sanitization, replaces mock dashboard feeds with real audit events, and decouples Express route handlers into domain services.

## Phases

- [ ] **Phase 1: Backup & Restore Integrity** - Guarantee complete 9-table backups and topological restore order without foreign key conflicts
- [ ] **Phase 2: Security Hardening & Registration Controls** - Enforce server-side registration locks and input sanitization on user submissions
- [ ] **Phase 3: Live Activity & Audit Trail** - Replace mock activity feeds with persistent departmental audit event streams
- [ ] **Phase 4: Architecture Modularity & Clean Services** - Decouple route handlers into domain services and clean up dead server instances

## Phase Details

### Phase 1: Backup & Restore Integrity
**Goal**: Ensure database exports capture complete evaluation history and restores execute safely without foreign key errors.
**Depends on**: Nothing (first phase)
**Requirements**: BACKUP-01, BACKUP-02, BACKUP-03
**Success Criteria** (what must be TRUE):
  1. `exportData()` exports all 9 tables: users, groups, members, topics, projects, milestones, assessments, notifications, sessions.
  2. `importData()` inserts records in topological order (groups → users → members → topics → projects → assessments → milestones).
  3. PostgreSQL sequence counters are safely aligned past imported maximum IDs to avoid duplicate key errors.
**Plans**: 2 plans

Plans:
- [ ] 01-01: Update `exportData` and `importData` in `server/db-storage.ts` for all 9 tables and foreign key order
- [ ] 01-02: Add automated backup/restore verification test script to `scripts/`

### Phase 2: Security Hardening & Registration Controls
**Goal**: Close registration bypass vectors and sanitize user text fields against XSS.
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. `POST /api/register` checks server-side registration open flag and returns 403 when registration is closed.
  2. User text inputs in topic proposals and feedback are sanitized before storage in PostgreSQL.
**Plans**: 2 plans

Plans:
- [ ] 02-01: Add server-side registration toggle middleware/check in `server/routes/auth.ts`
- [ ] 02-02: Implement text sanitization helper and integrate into topic and review endpoints

### Phase 3: Live Activity & Audit Trail
**Goal**: Deliver a transparent live audit and activity feed on the dashboard.
**Depends on**: Phase 2
**Requirements**: AUDIT-01, AUDIT-02
**Success Criteria** (what must be TRUE):
  1. `GET /api/activities` queries real recent records from PostgreSQL.
  2. Coordinators and Admins see live timestamped actions (topic approvals, supervisor allotments, default password resets).
**Plans**: 1 plan

Plans:
- [ ] 03-01: Implement dynamic activity aggregator in `server/routes/stats.ts`

### Phase 4: Architecture Modularity & Clean Services
**Goal**: Decouple Express route handlers into domain services following SOLID principles.
**Depends on**: Phase 3
**Requirements**: ARCH-01, ARCH-02
**Success Criteria** (what must be TRUE):
  1. Route handlers in `server/routes/` delegate complex business logic to dedicated services.
  2. Redundant `createServer(app)` call removed from `server/routes/index.ts`.
**Plans**: 2 plans

Plans:
- [ ] 04-01: Remove dead HTTP server instance in `server/routes/index.ts`
- [ ] 04-02: Extract topic and group business logic into modular service layers

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backup & Restore Integrity | 0/2 | Not started | - |
| 2. Security Hardening & Registration Controls | 0/2 | Not started | - |
| 3. Live Activity & Audit Trail | 0/1 | Not started | - |
| 4. Architecture Modularity & Clean Services | 0/2 | Not started | - |
