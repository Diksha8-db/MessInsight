# MessInsight Data Dictionary (Frozen Contract v1)

## Global Constraints & Enums
- **Timezone**: All business dates calculated in `MESS_TIMEZONE` (default `Asia/Kolkata`). Raw timestamps stored in UTC ISO 8601.
- **Roles Enum**: `STUDENT`, `MANAGER`, `ADMIN`
- **Meal Types Enum**: `BREAKFAST`, `LUNCH`, `SNACKS`, `DINNER`
- **Rating Range**: Integer `1` to `5`
- **Units Whitelist**: `kg`, `g`, `l`, `ml`, `count`
- **Complaint Category**: `FOOD_HYGIENE`, `WATER_QUALITY`, `CONTAMINATION`, `CLEANLINESS`, `FOOD_STORAGE`, `OTHER`
- **Complaint Priority**: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- **Complaint Status**: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `REJECTED`
- **Sentiment Labels**: `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `MIXED`, `UNCERTAIN`
- **Sentiment Status**: `PENDING`, `DONE`, `FAILED`
- **Prediction Source**: `ML`, `BASELINE`, `FALLBACK`

---

## 1. Users
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `name` | String | Yes | Full student/staff name, max 100 chars |
| `instituteEmail` | String | Yes | Lowercase, unique, restricted to institute domain allowlist |
| `passwordHash` | String | Yes | Bcrypt/Argon2 hashed password (never plaintext) |
| `role` | String | Yes | Enum: `STUDENT`, `MANAGER`, `ADMIN` (default `STUDENT`) |
| `isVerified` | Boolean | Yes | Email verification flag (default `false`) |
| `isBlocked` | Boolean | Yes | Administrative block flag (default `false`) |
| `assignedMessId` | ObjectId | No | References Mess/Hostel (required for `MANAGER`) |
| `tokenVersion` | Number | Yes | Integer counter for session invalidation (default `0`) |
| `failedLoginAttempts` | Number | Yes | Counter for brute-force lock (default `0`) |
| `lockoutUntil` | Date | No | Lockout expiry timestamp |
| `otpHash` | String | No | Hashed 6-digit OTP (never plaintext) |
| `otpExpiresAt` | Date | No | Expiration timestamp (10 minutes) |
| `otpAttempts` | Number | Yes | Max 5 attempts |
| `otpLastSentAt` | Date | No | Cooldown tracking (60s minimum) |
| `createdAt` | Date | Yes | UTC timestamp |
| `updatedAt` | Date | Yes | UTC timestamp |

**Indexes**:
- `unique`: `{ instituteEmail: 1 }`
- `index`: `{ role: 1 }`

---

## 2. Menus
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `messId` | ObjectId | Yes | Target mess identifier |
| `serviceDate` | String | Yes | Normalized ISO Date string `YYYY-MM-DD` |
| `mealType` | String | Yes | Enum: `BREAKFAST`, `LUNCH`, `SNACKS`, `DINNER` |
| `dishes` | Array | Yes | List of Dish subdocuments (min 1 dish to publish) |
| `status` | String | Yes | Enum: `DRAFT`, `PUBLISHED`, `ARCHIVED` (default `DRAFT`) |
| `version` | Number | Yes | Optimistic concurrency version (starts at `1`) |
| `publishedAt` | Date | No | Timestamp of publication |
| `isDeleted` | Boolean | Yes | Soft-delete flag (default `false`) |
| `createdAt` | Date | Yes | UTC timestamp |
| `updatedAt` | Date | Yes | UTC timestamp |

**Indexes**:
- `unique`: `{ messId: 1, serviceDate: 1, mealType: 1 }` (where `isDeleted: false`)

---

## 3. Dishes
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `name` | String | Yes | Name of dish (trimmed, sanitized, max 100 chars) |
| `category` | String | Yes | e.g. `MAIN_COURSE`, `SIDE_DISH`, `BEVERAGE`, `DESSERT` |
| `aliases` | Array<String> | No | Nicknames / common misspellings used by NLP engine |
| `isAvailable` | Boolean | Yes | Dish availability toggle (default `true`) |
| `isDeleted` | Boolean | Yes | Soft delete flag |

---

## 4. Feedback
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `studentId` | ObjectId | Yes | References User (anonymized in manager views if anonymous) |
| `menuId` | ObjectId | Yes | References Menu |
| `messId` | ObjectId | Yes | References Mess |
| `serviceDate` | String | Yes | `YYYY-MM-DD` |
| `mealType` | String | Yes | Meal enum |
| `overallRating` | Number | Yes | Integer `1` to `5` |
| `dishRatings` | Array | No | Subdocs: `{ dishId, rating (1-5) }` |
| `comments` | String | No | Trimmed text, max 1000 chars |
| `imageUrl` | String | No | Safe relative image path (JPEG/PNG/WebP only) |
| `isAnonymous` | Boolean | Yes | True = hides identity from manager / exports |
| `idempotencyKey`| String | No | Client duplicate prevention key |
| `sentiment` | Object | Yes | `{ label, score (-1 to 1), confidence, status: PENDING|DONE|FAILED, modelVersion }` |
| `dishesMentioned`| Array<String> | No | NLP-extracted dishes |
| `issues` | Array | No | NLP-extracted issues: `[{ type, dish }]` |
| `moderationStatus`| String | Yes | Enum: `OK`, `FLAGGED` (default `OK`) |
| `isDeleted` | Boolean | Yes | Soft delete flag (default `false`) |
| `createdAt` | Date | Yes | UTC timestamp |
| `updatedAt` | Date | Yes | UTC timestamp |

**Indexes**:
- `unique`: `{ studentId: 1, menuId: 1 }` (where `isDeleted: false`)
- `index`: `{ messId: 1, serviceDate: 1, mealType: 1 }`
- `index`: `{ 'sentiment.status': 1 }`

---

## 5. Complaints
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `studentId` | ObjectId | Yes | References User |
| `messId` | ObjectId | Yes | References Mess |
| `category` | String | Yes | Enum (`FOOD_HYGIENE`, `WATER_QUALITY`, etc.) |
| `priority` | String | Yes | Enum (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) |
| `status` | String | Yes | Enum: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `REJECTED` |
| `title` | String | Yes | Max 150 chars |
| `description` | String | Yes | Max 2000 chars |
| `imageUrl` | String | No | Attached photo |
| `feedbackId` | ObjectId | No | Optional link to originating feedback record |
| `managerResponse`| String | No | Explanation from mess manager |
| `resolvedAt` | Date | No | Resolution timestamp |
| `history` | Array | Yes | Audit log of state transitions |

**Indexes**:
- `index`: `{ messId: 1, status: 1 }`
- `index`: `{ studentId: 1 }`

---

## 6. Predictions
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `messId` | ObjectId | Yes | Target mess |
| `serviceDate` | String | Yes | Target date `YYYY-MM-DD` |
| `mealType` | String | Yes | Meal enum |
| `predictedAttendance`| Number | Yes | Non-negative integer (clamped to capacity) |
| `lowerBound` | Number | No | Empirical interval lower bound |
| `upperBound` | Number | No | Empirical interval upper bound |
| `rangeAvailable` | Boolean | Yes | True only if statistical interval was calculated |
| `confidenceStatus` | String | Yes | `HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT_DATA` |
| `source` | String | Yes | Enum: `ML`, `BASELINE`, `FALLBACK` |
| `modelVersion` | String | Yes | Tracking string (e.g. `rf-v1.0.2` or `historical-mean`) |
| `generatedAt` | Date | Yes | UTC timestamp |

**Indexes**:
- `index`: `{ messId: 1, serviceDate: 1, mealType: 1, generatedAt: -1 }`

---

## 7. AttendanceRecords
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `messId` | ObjectId | Yes | Target mess |
| `serviceDate` | String | Yes | `YYYY-MM-DD` |
| `mealType` | String | Yes | Meal enum |
| `actualAttendance` | Number | Yes | Non-negative integer (0 is valid, e.g. holiday) |
| `recordedBy` | ObjectId | Yes | Manager user id |
| `isManualEdit` | Boolean | Yes | Audit flag for retroactive updates |
| `createdAt` | Date | Yes | UTC timestamp |

**Indexes**:
- `unique`: `{ messId: 1, serviceDate: 1, mealType: 1 }`

---

## 8. WasteRecords
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `messId` | ObjectId | Yes | Target mess |
| `serviceDate` | String | Yes | `YYYY-MM-DD` |
| `mealType` | String | Yes | Meal enum |
| `ingredient` | String | Yes | Normalized ingredient name (e.g. `Rice`, `Dal`) |
| `preparedQuantity` | Number | Yes | Must be >= 0 |
| `consumedQuantity` | Number | Yes | Must be <= preparedQuantity |
| `leftoverQuantity` | Number | Yes | Must be <= preparedQuantity |
| `unaccountedDiff` | Number | Yes | prepared - (consumed + leftover) |
| `unit` | String | Yes | Whitelist: `kg`, `g`, `l`, `ml`, `count` |
| `recordedBy` | ObjectId | Yes | Manager user id |

**Indexes**:
- `unique`: `{ messId: 1, serviceDate: 1, mealType: 1, ingredient: 1 }`

---

## 9. Notifications
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `userId` | ObjectId | Yes | Recipient user |
| `eventKey` | String | Yes | Idempotency deduplication key |
| `title` | String | Yes | Max 100 chars |
| `message` | String | Yes | Max 500 chars |
| `linkUrl` | String | No | Target internal route |
| `isRead` | Boolean | Yes | Default `false` |
| `createdAt` | Date | Yes | UTC timestamp |

**Indexes**:
- `unique`: `{ userId: 1, eventKey: 1 }`
- `index`: `{ userId: 1, isRead: 1, createdAt: -1 }`

---

## 10. Reports
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `type` | String | Yes | `DAILY`, `WEEKLY`, `MONTHLY`, `WASTE`, `ACCURACY` |
| `paramsHash` | String | Yes | SHA-256 of normalized query parameters |
| `dateRange` | Object | Yes | `{ from: YYYY-MM-DD, to: YYYY-MM-DD }` |
| `data` | Object | Yes | Aggregated figures |
| `generatedBy` | ObjectId | Yes | User ID |
| `createdAt` | Date | Yes | UTC timestamp |

**Indexes**:
- `unique`: `{ type: 1, paramsHash: 1 }`

---

## 11. AuditLogs
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `actorId` | ObjectId | Yes | User performing action |
| `action` | String | Yes | e.g. `USER_BLOCK`, `ROLE_CHANGE`, `MENU_PUBLISH` |
| `targetCollection`| String | Yes | Affected collection name |
| `targetId` | ObjectId | No | Affected record ID |
| `correlationId` | String | Yes | Request correlation ID |
| `summary` | String | Yes | Human-readable change summary (strictly NO secrets) |
| `createdAt` | Date | Yes | UTC timestamp |

**Indexes**:
- `index`: `{ actorId: 1, createdAt: -1 }`
- `index`: `{ action: 1 }`
- `index`: `{ correlationId: 1 }`

---

## 12. Settings
| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | Unique identifier |
| `messId` | ObjectId | Yes | Associated mess |
| `serviceWindows` | Object | Yes | Service time windows per mealType |
| `feedbackEditWindowMinutes` | Number | Yes | Window in minutes to edit feedback (default 30) |
| `servingStandards` | Array | Yes | `[{ ingredient, amountPerPerson, unit }]` |
| `defaultSafetyBufferPct` | Number | Yes | Safety buffer percentage (0-50%) |

