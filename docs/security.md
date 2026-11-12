# MessInsight — Security Architecture & Threat Model

## 1. Authentication & Session Management

- **HttpOnly Cookies**: Session tokens are stored exclusively in `HttpOnly`, `SameSite=Lax` (or `Strict`), `Secure` cookies. Browser JavaScript cannot access or exfiltrate the JWT.
- **Session Revocation (`tokenVersion`)**: Every User document tracks a numeric `tokenVersion`. Changing passwords, logging out, or administrative deactivation increments `tokenVersion`, instantly invalidating all outstanding JWT sessions across all devices.
- **OTP Protection**: Verification OTPs are 6-digit cryptographically secure codes hashed before storage, expiring in 10 minutes with rate-limiting and maximum 5 attempts.

---

## 2. Authorization & Multi-Tenancy Isolation

- **Role-Based Access Control (RBAC)**:
  - `STUDENT`: May view published menus, submit feedback, edit feedback within 24 hours, and file complaints.
  - `MANAGER`: Scoped strictly to their assigned `messId` via `requireMessScope()`. Cannot modify menus, view feedback, or record attendance for unauthorized canteens.
  - `ADMIN`: Global oversight for user role promotion, system-wide statistics, and security audit log inspection.
- **Identity Derivation**: `rejectClientIdentity()` rejects any request where a client attempts to pass `userId`, `role`, or `messId` in the body payload. Identities are derived exclusively from the verified session.

---

## 3. Feedback Anonymity Guarantee

When a student checks "Submit Anonymously":
1. `isAnonymous: true` is persisted in the database.
2. In all manager-facing endpoints (`FeedbackRepository.listMessFeedback`, `exportCsv`), the `studentId` field is strictly stripped and deleted before serialization.
3. Managers and canteen contractors have zero access to the author's identity.

---

## 4. Input Sanitization & Formula Injection Protection

- **Zod Strict Validation**: All route inputs are validated with Zod schemas.
- **CSV Formula Injection Mitigation**: Any export cell beginning with spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) is automatically prefixed with an apostrophe `'` to neutralize executable macros in Excel and Google Sheets.
- **XSS Sanitization**: User comments and menu titles are trimmed and sanitized before storage.

---

## 5. Network & ML Service Isolation

- **Closed CORS Policy**: The FastAPI ML microservice explicitly rejects browser CORS requests (`allow_origins=[]`).
- **Server-to-Server Authentication**: The Next.js backend is the sole gateway to the ML service, authenticated via a cryptographically compared `X-ML-Secret` header using constant-time `hmac.compare_digest`.
- **Circuit Breaker Resiliency**: If the ML service fails 5 consecutive times, the in-memory `CircuitBreaker` trips `OPEN` for 60 seconds, preventing thread starvation and instantly falling back to historical statistical averages.

