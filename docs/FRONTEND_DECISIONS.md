# Gastos — Frontend Architecture Decisions

Documents every tool selection and architectural decision for the frontend layer, with reasoning.

---

## Architecture

### Monorepo

The frontend lives in a `frontend/` folder at the root of this repository, alongside the existing `src/` backend.

**Why:** The backend and frontend are developed by the same person, share the same deployment lifecycle, and will eventually share TypeScript types (API response shapes). A separate repo adds cross-repo PR overhead with no benefit at this scale.

**Structure:**
```
gastos/                  ← repo root
  src/                   ← backend (Fastify, existing)
  frontend/              ← React SPA (new)
  docs/
  package.json           ← backend deps only
  frontend/package.json  ← frontend deps only (separate install)
```

The frontend has its own `package.json` and `node_modules`. No shared npm workspace is needed — they are just co-located.

---

### SPA (Single Page Application), not SSR

All routes in this app are behind authentication. There are no public-facing pages, no SEO requirements.

**Why not Next.js / Remix:** Server-Side Rendering adds infrastructure complexity (a running Node.js server for the frontend) and React Server Components overhead that has zero benefit when every page requires a login. A static SPA is simpler, cheaper to host, and faster to develop.

**Deployment target:** Vercel (already noted in TECH_DOMAIN.md) — deploys a static SPA for free with zero config.

---

### Vite as build tool

Create React App is officially deprecated. Vite is the current standard for React SPAs.

**Why Vite:**
- Sub-50ms Hot Module Replacement during development
- Native TypeScript support with no config
- Uses esbuild (dev) + Rollup (prod) — fast builds
- Deploy-anywhere static output

---

## Stack

### React + TypeScript

TypeScript is already used throughout the backend. Consistency across the codebase.

---

### TanStack Query (server state)

Handles all data fetched from the Fastify API: caching, loading states, error states, background refetching, cache invalidation after mutations, and retry logic.

Replaces what would otherwise require Redux + Sagas + manual loading/error boilerplate.

---

### Zustand (client state)

Handles UI-only state that doesn't come from the server: open modals, selected filters, active navigation item.

Used minimally — most state in this app is server state managed by TanStack Query.

---

### React Hook Form + Zod (forms and validation)

React Hook Form manages form state with minimal re-renders. Zod defines validation schemas that are reused for both form validation (client) and can be shared with API type definitions.

Every data-entry screen in this app (log expense, create budget, add payment instrument) is a form. These tools are purpose-built for that.

---

### React Router v7

Client-side routing for the SPA. Maps URL paths to page components without a full page reload.

---

## Folder Structure

Feature-based organization — each feature owns its components, hooks, and API calls.

```
frontend/
  src/
    features/
      expenses/
        components/
        hooks/
        api.ts
      budgets/
        components/
        hooks/
        api.ts
      catalogue/
        components/
        hooks/
        api.ts
      payment-instruments/
        components/
        hooks/
        api.ts
      identity/
        components/
        hooks/
        api.ts
    shared/
      components/       ← reusable UI primitives (Button, Modal, etc.)
      hooks/            ← shared hooks (useAuth, etc.)
      api/
        client.ts       ← base fetch client (sets X-User-Id / X-Household-Id headers)
      types/            ← shared TypeScript types
    main.tsx
    App.tsx
  index.html
  vite.config.ts
  tsconfig.json
  package.json
```

---

## API Communication

The frontend communicates with the Fastify backend via REST. Auth is handled via headers, not cookies:

- `X-User-Id` — required on all routes except `POST /api/users`
- `X-Household-Id` — required on catalogue, expense, and budget routes

The base fetch client (`shared/api/client.ts`) injects these headers automatically on every request.

During local development, Vite's dev server proxies `/api` requests to `localhost:8080` to avoid CORS issues.

---

## Tooling

| Concern | Tool |
|---|---|
| Build / dev server | Vite |
| Language | TypeScript |
| UI framework | React |
| Routing | React Router v7 |
| Server state | TanStack Query |
| Client state | Zustand |
| Forms | React Hook Form |
| Validation | Zod |
| Hosting | Vercel |
