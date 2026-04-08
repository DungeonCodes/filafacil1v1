# Run Log - 2026-04-08 - Atendente Call Next False Success Fix

## Purpose
Diagnose and fix the `/atendente` case where clicking `Chamar proximo` showed success but no ticket moved into the current initial attendance card and the waiting queue kept showing the same tickets.

## Reference inputs used
- `workflow/SESSION_START.md`
- `workflow/PROJECT_CONTEXT.md`
- `workflow/ARCHITECTURE.md`
- `workflow/DB_SCHEMA.md`
- `workflow/DECISIONS.md`
- `workflow/BACKLOG.md`
- `src/app/atendente/page.tsx`
- `src/features/atendente/AtendenteScreen.tsx`
- `src/features/atendente/api.ts`
- `src/features/atendente/types.ts`
- `src/features/atendente/AtendenteScreen.test.tsx`
- `src/features/atendente/api.test.ts`
- `src/features/totem/api.ts`

## Root cause
- The live ticket contract already exposes `ticket_date` in the totem/RPC flow.
- The attendant snapshot was not filtering by `ticket_date`, so the waiting queue UI could show historical `waiting_attendant` tickets that were not actually eligible for `call_next_attendant`.
- `call_next_attendant` was being treated as success whenever the RPC returned without an error, even if no ticket was effectively transitioned to `called_attendant`.
- This produced false success feedback: the UI said the next ticket was called while the refreshed snapshot still had no `currentTicket` and the waiting list still showed the same entries.

## Files changed in this task
- `src/features/atendente/api.ts`
- `src/features/atendente/AtendenteScreen.tsx`
- `src/features/atendente/api.test.ts`
- `src/features/atendente/AtendenteScreen.test.tsx`
- `workflow/DB_SCHEMA.md`
- `workflow/RUN_LOGS/2026-04-08-atendente-call-next-false-success-fix.md`

## What changed
- Aligned `loadAttendantSnapshot` with the real eligibility contract by filtering attendant queries by the current business `ticket_date`.
- Updated `handleCallNext` to reload the attendant snapshot immediately after the RPC and only show success when a real transition to `called_attendant` is visible in the refreshed data.
- Added an error path for no-op calls so the UI no longer simulates success when no eligible ticket was actually called.
- Added a component test covering the successful transition from waiting queue to current attendance.
- Added a component test covering the false-success scenario where the RPC returns without error but no ticket actually moves.
- Added an API test locking the new `ticket_date` filter behavior in the attendant snapshot.

## Validation performed
- `npm run lint` -> passed
- `npm run test:run` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed on the second run after the known local `.next/types` issue appeared on the first run

## What is now working
- A real called ticket appears in `Senha em atendimento inicial` when `Chamar proximo` actually transitions an eligible waiting ticket.
- The waiting queue immediately stops listing the ticket that was moved into `called_attendant`.
- The success message is only shown when the refreshed snapshot confirms a real transition.
- If no ticket is truly eligible, the attendant panel now shows an error instead of false success.

## Out of scope
- No change to `/medico`
- No backend SQL extraction or RPC redesign
- No auth, layout, or accessibility changes
