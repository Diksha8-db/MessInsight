# MessInsight — REST API Specification Reference

All API routes follow a standard JSON response envelope and include an `x-correlation-id` header for end-to-end tracing.

### Standard Response Envelope

```json
// Success Response
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "meta": { "page": 1, "total": 45 }
}

// Error Response
{
  "success": false,
  "message": "Human-readable error description",
  "error": {
    "code": "VALIDATION_ERROR",
    "correlationId": "8b23ad45-3129-4ee7-9bcf-1234567890ab",
    "details": { ... }
  }
}
```

---

## 1. Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register student or manager account |
| `POST` | `/api/auth/verify-email` | Public | Verify email OTP code |
| `POST` | `/api/auth/resend-otp` | Public | Resend OTP code |
| `POST` | `/api/auth/login` | Public | Authenticate user and issue HttpOnly cookie |
| `POST` | `/api/auth/logout` | Authenticated | Revoke session and clear cookie |
| `GET` | `/api/auth/me` | Authenticated | Get current user profile and role |
| `POST` | `/api/auth/forgot-password` | Public | Send password reset OTP |
| `POST` | `/api/auth/reset-password` | Public | Reset password with OTP |
| `POST` | `/api/auth/change-password` | Authenticated | Change password and invalidate other sessions |

---

## 2. Menu Endpoints (`/api/menu` & `/api/manager/menu`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/menu/today` | Student / Public | View today's published meal menus |
| `GET` | `/api/menu/weekly` | Student / Public | View current week published menus |
| `GET` | `/api/manager/menu` | Manager | List all menus for manager's mess |
| `POST` | `/api/manager/menu` | Manager | Create draft meal menu |
| `GET` | `/api/manager/menu/:id` | Manager | View menu detail |
| `PUT` | `/api/manager/menu/:id` | Manager | Update draft menu items |
| `POST` | `/api/manager/menu/:id/availability` | Manager | Toggle dish availability in real-time |
| `POST` | `/api/manager/menu/publish` | Manager | Publish menu |

---

## 3. Student Feedback & Complaints (`/api/student`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/student/feedback` | Student | Submit meal feedback with dish ratings |
| `GET` | `/api/student/feedback` | Student | View student's historical feedbacks |
| `PUT` | `/api/student/feedback/:id` | Student | Edit feedback within 24-hour edit window |
| `DELETE`| `/api/student/feedback/:id` | Student | Soft delete feedback |
| `POST` | `/api/student/feedback/upload` | Student | Upload dish photo (magic byte validated) |
| `POST` | `/api/student/complaints` | Student | File canteen hygiene/food quality complaint |
| `GET` | `/api/student/complaints` | Student | View filed complaints and status updates |
| `GET` | `/api/student/notifications` | Student | Poll unread notifications |

---

## 4. Manager Operations & AI (`/api/manager`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/manager/feedback` | Manager | View mess feedback (studentId stripped if anonymous) |
| `GET` | `/api/manager/complaints` | Manager | List complaints for mess |
| `PUT` | `/api/manager/complaints/:id/status` | Manager | Update complaint status with manager note |
| `GET` | `/api/manager/attendance` | Manager | List recorded attendance |
| `POST` | `/api/manager/attendance` | Manager | Record / update meal attendance count |
| `GET` | `/api/manager/waste` | Manager | List ingredient waste records |
| `POST` | `/api/manager/waste` | Manager | Record daily food waste & leftovers |
| `POST` | `/api/manager/predictions/generate` | Manager | Run ML attendance forecast for date & meal |
| `GET` | `/api/manager/predictions/accuracy` | Manager | Compare predicted vs actual attendance |
| `POST` | `/api/manager/quantity/recommend` | Manager | Calculate exact ingredient quantities with buffer |
| `GET` | `/api/manager/analytics/ratings` | Manager | Daily rating trends and dish leaderboards |
| `GET` | `/api/manager/analytics/sentiment` | Manager | NLP sentiment distributions and top issues |
| `GET` | `/api/manager/analytics/attendance` | Manager | Actual attendance trends |
| `GET` | `/api/manager/analytics/waste` | Manager | Ingredient waste percentages |
| `GET` | `/api/manager/reports` | Manager | List generated reports |
| `POST` | `/api/manager/reports` | Manager | Compile new audit report |
| `GET` | `/api/manager/reports/:id/export`| Manager | Download sanitised CSV report |

---

## 5. Administration Endpoints (`/api/admin`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Admin | Global platform statistics |
| `GET` | `/api/admin/users` | Admin | List and search all user accounts |
| `POST` | `/api/admin/users/:id/block` | Admin | Deactivate user account |
| `POST` | `/api/admin/users/:id/unblock` | Admin | Reactivate user account |
| `POST` | `/api/admin/users/:id/assign-manager` | Admin | Assign manager to specific mess |
| `GET` | `/api/admin/audit-logs` | Admin | Query immutable system audit logs |

