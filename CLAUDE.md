# Gastos — Project Rules

## API Types

**After changing any route schema (request body, query params, or response shape), run:**

```
npm run gen:types
```

This regenerates `src/http/api-types.ts` from the live OpenAPI spec. The frontend depends on this file for type-safe API calls.
