# Claude Code Memory for repostats

## Cache Invalidation

When making changes that affect the API response structure (adding/removing/renaming fields), bump the `CACHE_SCHEMA_VERSION` constant in:

**File:** `server/src/cache/cache.ts`

```typescript
const CACHE_SCHEMA_VERSION = 5;  // Increment this
```

This ensures old cached responses are automatically invalidated without requiring manual cache deletion.

**Important:** Also bump the cache schema version when fixing bugs in analysis logic, even if the response structure hasn't changed. Cached results from the buggy code need to be invalidated so users see correct data.

## Project Structure

- `server/` - Express.js backend
- `client/` - React frontend
- Both use TypeScript with shared type definitions that must be kept in sync:
  - `server/src/types/types.ts`
  - `client/src/types/types.ts`
