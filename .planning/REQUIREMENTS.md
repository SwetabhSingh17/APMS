# Requirements: IntegralProjectHub (APMS)

**Defined:** 2026-10-06
**Core Value:** Streamline and govern the academic project lifecycle with strict course isolation (BCA vs MCA), balanced faculty mentorship workload limits, and transparent real-time status reflection across all departmental stakeholders.

## v1 Requirements

Requirements for current milestone improvements. Each maps to roadmap phases.

### Data Integrity & Backups

- [ ] **BACKUP-01**: Backup export archives all 9 database tables including assessments, milestones, and notifications
- [ ] **BACKUP-02**: Backup restore inserts records in strict topological dependency order without foreign key violations
- [ ] **BACKUP-03**: Sequences are re-synchronized past imported maximum IDs after restore

### Security & Access Control

- [ ] **SEC-01**: Server-side registration closure toggle in `/api/register` rejects unauthorized registration requests
- [ ] **SEC-02**: Server-side input sanitization cleans user text fields (topic descriptions, student feedback) before persistence

### System Observability & Activity

- [ ] **AUDIT-01**: Dynamic audit event logging replaces static mock list in `GET /api/activities`
- [ ] **AUDIT-02**: Dashboard displays real department events (topic approvals, team allotments, password resets)

### Architecture & Modularity

- [ ] **ARCH-01**: Route handlers delegate business logic to decoupled service modules
- [ ] **ARCH-02**: Remove redundant HTTP server instantiation in `server/routes/index.ts`

## v2 Requirements

Deferred to future releases.

### Performance & Scaling

- **PERF-01**: Redis pub/sub adapter for multi-instance WebSocket broadcasting
- **PERF-02**: Worker threads or streaming parser for massive multi-megabyte Excel workbooks

### Features

- **FEAT-01**: Transactional email dispatch (SMTP/Nodemailer) for offline alerts
- **FEAT-02**: PDF export capabilities for official student project allocation sheets

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Public Cloud Storage (S3/GCS) | System is intentionally built for self-contained institutional on-premise and LAN deployments |
| Third-party OAuth / Social Login | Identity relies exclusively on verified university enrollment numbers and employee IDs |
| Client-Side Registration Bypasses | Registration closure must be enforced strictly server-side |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BACKUP-01 | Phase 1 | Pending |
| BACKUP-02 | Phase 1 | Pending |
| BACKUP-03 | Phase 1 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| AUDIT-01 | Phase 3 | Pending |
| AUDIT-02 | Phase 3 | Pending |
| ARCH-01 | Phase 4 | Pending |
| ARCH-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-10-06*
*Last updated: 2026-10-06 after initialization*
