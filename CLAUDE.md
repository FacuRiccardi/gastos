# Gastos — Project Rules

## API Types

**After changing any route schema (request body, query params, or response shape), run:**

```
cd backend && npm run gen:types
```

This regenerates `shared/api-types.ts` from the live OpenAPI spec. The frontend depends on this file for type-safe API calls.
