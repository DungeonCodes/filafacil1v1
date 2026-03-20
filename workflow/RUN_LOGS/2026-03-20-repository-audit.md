# Run Log - 2026-03-20 - Repository Audit

## Purpose
Audit repository state and create workflow continuity documentation without changing product behavior.

## Repository state observed
- `workflow/` did not exist before this audit.
- Main app routes implemented:
  - `/`
  - `/login`
  - `/totem`
  - `/painel-chamada`
  - `/atendente`
  - `/medico`
  - `/admin`
- Internal auth routes implemented:
  - `/api/auth/login`
  - `/api/auth/logout`
- Admin management routes implemented:
  - `/api/admin/users`
  - `/api/admin/users/[userId]/status`
  - `/api/admin/users/[userId]/password`
- Accessibility currently implemented:
  - high contrast
  - panel speech announcements
  - totem guided voice mode

## Important findings
- The repository versions `supabase/auth.sql` only.
- Core queue-domain schema and RPC SQL are still external project state.
- Local `npm run typecheck` can fail before a build when `.next/types` is missing or stale.

## Validation performed
- `npm run lint` -> passed
- `npm run test:run` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed after `build`

## Notes for future sessions
- Use `workflow/` as the first stop, not prior conversation context.
- Treat missing base SQL as the next continuity problem to solve before further backend-heavy work.
