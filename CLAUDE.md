# Claude Code Memory for repostats

## Cache Invalidation

**ALWAYS bump the `CACHE_SCHEMA_VERSION`** in `server/src/cache/cache.ts` when:

1. **Adding/removing/renaming fields** in API response structures
2. **Adding new cached endpoints** that use the cache infrastructure
3. **Fixing bugs in analysis logic** - cached results from buggy code need invalidation

```typescript
const CACHE_SCHEMA_VERSION = 15;  // Increment this
```

This ensures old cached responses are automatically invalidated without requiring manual cache deletion.

## Project Structure

- `server/` - Express.js backend
- `client/` - React frontend
- Both use TypeScript with shared type definitions that must be kept in sync:
  - `server/src/types/types.ts`
  - `client/src/types/types.ts`
