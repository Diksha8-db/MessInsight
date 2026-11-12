# MessInsight — Database Schema & Data Dictionary

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USER ||--o{ FEEDBACK : "submits"
    USER ||--o{ COMPLAINT : "files"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ AUDIT_LOG : "triggers"
    MESS ||--o{ MENU : "publishes"
    MESS ||--o{ ATTENDANCE_RECORD : "records"
    MESS ||--o{ WASTE_RECORD : "tracks"
    MESS ||--o{ PREDICTION : "forecasts"
    MENU ||--o{ FEEDBACK : "evaluated_by"
    MENU ||--|{ DISH : "contains"
    FEEDBACK ||--o| COMPLAINT : "escalates_to"
    REPORT ||--|| USER : "generated_by"

    USER {
        ObjectId _id PK
        string email UK
        string passwordHash
        string fullName
        enum role "STUDENT, MANAGER, ADMIN"
        ObjectId messId FK
        boolean isEmailVerified
        boolean isBlocked
        int tokenVersion
    }

    MENU {
        ObjectId _id PK
        ObjectId messId FK
        string serviceDate
        enum mealType "BREAKFAST, LUNCH, SNACKS, DINNER"
        array dishes
        enum status "DRAFT, PUBLISHED, ARCHIVED"
        int version
    }

    FEEDBACK {
        ObjectId _id PK
        ObjectId studentId FK
        ObjectId menuId FK
        ObjectId messId FK
        int overallRating "1-5"
        array dishRatings
        string comments
        boolean isAnonymous
        string idempotencyKey
        object sentiment
        array dishesMentioned
        array issues
        enum moderationStatus "OK, FLAGGED"
        boolean isDeleted
    }

    COMPLAINT {
        ObjectId _id PK
        ObjectId studentId FK
        ObjectId messId FK
        enum category
        enum priority
        enum status "OPEN, IN_PROGRESS, RESOLVED, REJECTED"
        string title
        string description
        string managerResponse
        array history
    }

    ATTENDANCE_RECORD {
        ObjectId _id PK
        ObjectId messId FK
        string serviceDate
        enum mealType
        int actualAttendance
        ObjectId recordedBy FK
        boolean isManualEdit
    }

    WASTE_RECORD {
        ObjectId _id PK
        ObjectId messId FK
        string serviceDate
        enum mealType
        string ingredient
        float preparedQuantity
        float consumedQuantity
        float leftoverQuantity
        float unaccountedDiff
        enum unit "kg, g, l, ml, count"
    }

    PREDICTION {
        ObjectId _id PK
        ObjectId messId FK
        string serviceDate
        enum mealType
        int predictedAttendance
        int lowerBound
        int upperBound
        enum source "ML, BASELINE, FALLBACK"
        string modelVersion
    }

    REPORT {
        ObjectId _id PK
        enum type "DAILY, WEEKLY, MONTHLY, WASTE, ACCURACY"
        string paramsHash UK
        object dateRange
        object data
        ObjectId generatedBy FK
    }
```

---

## 2. Key Indexes & Constraints

1. **Unique Constraints**:
   - `User`: `{ email: 1 }`
   - `Menu`: `{ messId: 1, serviceDate: 1, mealType: 1 }`
   - `AttendanceRecord`: `{ messId: 1, serviceDate: 1, mealType: 1 }`
   - `WasteRecord`: `{ messId: 1, serviceDate: 1, mealType: 1, ingredient: 1 }`
   - `Report`: `{ type: 1, paramsHash: 1 }`
   - `Notification`: `{ userId: 1, eventKey: 1 }`

2. **Compound Query Indexes**:
   - `Feedback`: `{ messId: 1, serviceDate: 1, mealType: 1, isDeleted: 1 }`
   - `Feedback`: `{ studentId: 1, menuId: 1, isDeleted: 1 }`
   - `Prediction`: `{ messId: 1, serviceDate: 1, mealType: 1, generatedAt: -1 }`
   - `Complaint`: `{ messId: 1, status: 1, createdAt: -1 }`
   - `AuditLog`: `{ correlationId: 1, timestamp: -1 }`

