# Run Log - 2026-04-08 - Admin Clear Operational Panels

## Purpose
Add an admin-only action in `/admin` to safely clear the current operational visual state shown in `/painel-chamada`, `/atendente`, and `/medico`, using an explicit double-check flow.

## Reference inputs used
- `workflow/SESSION_START.md`
- `workflow/PROJECT_CONTEXT.md`
- `workflow/ARCHITECTURE.md`
- `workflow/DB_SCHEMA.md`
- `workflow/DECISIONS.md`
- `workflow/BACKLOG.md`
- `src/features/painel-chamada/api.ts`
- `src/features/painel-chamada/PainelChamadaScreen.tsx`
- `src/features/atendente/api.ts`
- `src/features/atendente/AtendenteScreen.tsx`
- `src/features/medico/api.ts`
- `src/features/medico/MedicoScreen.tsx`
- `src/features/admin/AdminScreen.tsx`
- `src/features/admin/api.ts`
- `src/features/admin/AdminScreen.test.tsx`
- `src/lib/auth/api-guards.ts`
- `src/lib/supabase/service.ts`

## Technical decision
- The reset was implemented as a small admin-only server route instead of client-side multi-step mutations.
- The route scopes the cleanup to the current business day using `ticket_date`, which matches the existing operational contract already used by the application.
- Instead of deleting ticket history, the reset clears only operational state:
  - `called_attendant` returns to `waiting_attendant`
  - `called_doctor` returns to `waiting_doctor`
  - `called_at` and `current_consulting_room` are cleared
  - `calls` entries for the current business day are removed so the visual recent-calls panels are emptied

## Files changed in this task
- `src/app/api/admin/panels/reset/route.ts`
- `src/features/admin/AdminScreen.tsx`
- `src/features/admin/AdminScreen.test.tsx`
- `src/features/admin/operationsApi.ts`
- `src/features/painel-chamada/api.ts`
- `src/features/medico/api.ts`
- `src/features/atendente/api.ts`
- `src/lib/tickets/businessDate.ts`
- `workflow/RUN_LOGS/2026-04-08-admin-clear-operational-panels.md`

## What changed
- Added a visible `Limpar painis de atendimento` action to the admin dashboard.
- Added a double-check confirmation state before the cleanup is executed.
- Added an admin-only API route that resets the current operational ticket states and clears same-day call history.
- Aligned `/painel-chamada` and `/medico` operational snapshot queries to the current business `ticket_date` so the reset clears the same visual scope the operators see.
- Reused the shared business-date helper in the attendant flow to keep the operational panels consistent.
- Added a focused admin test covering the double-check flow and successful reset feedback.

## Validation performed
- `npm run lint` -> passed
- `npm run test:run` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed

## What is now working
- `/admin` exposes a clear and guarded action to reset the current operational panels.
- After confirmation, `/painel-chamada` stops showing the current day recent calls and active calling state.
- After confirmation, `/atendente` no longer shows an in-progress initial attendance ticket.
- After confirmation, `/medico` no longer shows an in-progress medical attendance ticket.
- New tickets can continue flowing normally after the cleanup because waiting stages are preserved instead of being destroyed.

## Out of scope
- No redesign of the admin dashboard beyond the new action and confirmation UI
- No changes to auth model besides using the existing admin guard
- No destructive purge of ticket history outside the current operational visual state
