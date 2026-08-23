# Security Policy

## Supported Versions

Currently, the following versions of this project are actively supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| v1.6.x  | :white_check_mark: |
| v1.5.x  | :x:                |
| < v1.5  | :x:                |

## Security Posture (v1.6.0)

APMS ships with the following protections in place:

- **Authentication** — Passport.js local strategy with scrypt password hashing; PostgreSQL-backed sessions with a 15-minute rolling inactivity expiry.
- **Authorization** — Role-based access control (Admin / Coordinator / Supervisor / Student) enforced server-side via `requireRole()` plus per-resource ownership checks (projects, assessments, notifications).
- **Rate Limiting** — `express-rate-limit` on `/api/login` and `/api/register`.
- **Security Headers** — Helmet middleware (CSP enabled in production).
- **Soft Deletes** — Users and topics are retained via an `is_deleted` flag; queries filter them automatically.
- **Session-Authenticated WebSockets** — Real-time notification sockets validate the signed session cookie server-side; identity cannot be spoofed via query parameters.
- **Hardened Destructive Operations** — Database reset requires the admin to re-enter their password (verified against the scrypt hash) and fully destroys the server session afterward.
- **No Hash Leakage** — Password hashes are stripped from every API response, including legacy compatibility endpoints.

## Reporting a Vulnerability

We take the security of our project seriously. If you discover a security vulnerability, please follow these steps:

1. **Do not open a public issue.** This ensures the vulnerability is not exploited before a patch is available.
2. Please report the vulnerability privately by emailing us at `security@example.com` or by opening a Draft Security Advisory on GitHub.
3. Provide a clear description of the vulnerability, including steps to reproduce it and the potential impact.

We will strive to acknowledge your report within 48 hours, and will provide an expected timeline for a fix and a coordinated release. Thank you for helping keep this project safe!
