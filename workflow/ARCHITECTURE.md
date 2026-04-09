# Architecture

## Frontend structure
- App Router pages live in `src/app/`.
- Feature screens live in `src/features/<feature>/`.
- Shared UI includes:
  - `src/components/MainTopNav.tsx`
  - `src/features/accessibility/HighContrastProvider.tsx`
  - `src/features/accessibility/HighContrastToggle.tsx`

## Route protection model
- Page-level authorization is handled in server components via `requireAuthenticatedUser(...)`.
- There is no `middleware.ts`.
- API-level authorization for admin endpoints is handled separately via `requireApiAuthenticatedUser(...)`.

## Auth architecture
- Browser session cookies are handled with `@supabase/ssr`.
- Server auth/session helpers:
  - `src/lib/supabase/server.ts`
  - `src/lib/supabase/route-handler.ts`
  - `src/lib/supabase/service.ts`
  - `src/lib/auth/session.ts`
  - `src/lib/auth/guards.ts`
- User roles are modeled in `app_users` rather than only in auth metadata.

## Data access model
- Feature data access for queues, tickets, calls, and dashboard metrics is still mostly browser-side through `getSupabaseBrowserClient()`.
- Current feature API modules directly query Supabase tables/RPC functions from the client:
  - `src/features/totem/api.ts`
  - `src/features/painel-chamada/api.ts`
  - `src/features/atendente/api.ts`
  - `src/features/medico/api.ts`
  - `src/features/admin/api.ts`
- Priority-aware `call next` behavior for attendant and doctor now lives in shared app code via `src/lib/tickets/callNextWithPriority.ts`, instead of relying on external RPC ordering rules that are not versioned in the repository.
- Admin user management is server-side through Next.js route handlers under `src/app/api/admin/`.

## Accessibility architecture
- High contrast:
  - global state via context
  - persisted in `localStorage`
  - applied by `data-high-contrast` on `<html>`
- Public panel audio:
  - polling-based change detection
  - Web Speech API speech synthesis
  - browser-only fallback
- Totem guided voice:
  - controlled finite-state flow
  - fixed command vocabulary
  - speech synthesis + speech recognition
  - confirmation required before side effects

## Dashboard architecture
- `/admin` uses Recharts.
- `next.config.mjs` transpiles `recharts` and `victory-vendor` to avoid runtime bundle interop issues in Next.js.

## Testing and CI
- Unit/component tests exist for:
  - ticket formatting
  - totem
  - painel-chamada
  - atendente
  - medico
  - admin
- CI workflow runs:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:run`
  - `npm run build`
