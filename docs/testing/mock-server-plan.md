# Mock Server Strategy for Frontend Decoupling

## Purpose
Enables Member 1 (Frontend) to develop and verify all student, manager, and admin user interfaces against the frozen API contracts (`docs/openapi.yaml`) without waiting for database or ML backend implementation.

## Guidelines
- **Development Only**: Mock configurations are restricted to local development and test environments (`NODE_ENV === 'development'` or MSW in browser/tests). Mock code is strictly excluded from production builds.
- **Contract Driven**: Responses are strictly typed against schemas in `docs/openapi.yaml`.

## Approaches

### Option A: OpenAPI Mock Server (Prism CLI)
Run Prism directly against the frozen OpenAPI contract:
```bash
npx @stoplight/prism-cli mock docs/openapi.yaml -p 4010
```
This serves real mock responses matching the exact OpenAPI response schemas on port 4010.

### Option B: Mock Service Worker (MSW) in `apps/web`
For in-browser mocking without a separate CLI process:
1. Define handlers in `src/mocks/handlers.ts` mapping standard `ApiSuccessResponse` payloads.
2. Initialize MSW conditionally in `src/app/layout.tsx` only when `process.env.NEXT_PUBLIC_ENABLE_MOCKS === 'true'`.
3. Ensures all frontend components receive the exact same response envelope:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "meta": { ... }
}
```

