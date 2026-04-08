# Run Log - 2026-04-08 - Admin Clear Operational Panels Follow-up Fix

## Purpose
Correct the `/admin` panel cleanup action so that, after running the reset and without any new tickets being generated, `/painel-chamada`, `/atendente`, and `/medico` all remain visually empty and consistent.

## Reference inputs used
- `workflow/SESSION_START.md`
- `workflow/PROJECT_CONTEXT.md`
- `workflow/ARCHITECTURE.md`
- `workflow/DB_SCHEMA.md`
- `workflow/DECISIONS.md`
- `workflow/BACKLOG.md`
- `src/app/api/admin/panels/reset/route.ts`
- `src/features/admin/AdminScreen.tsx`
- `src/features/admin/operationsApi.ts`
- `src/features/painel-chamada/api.ts`
- `src/features/atendente/api.ts`
- `src/features/medico/api.ts`

## Root cause
- The post-reset queries were internally consistent: they show tickets in `waiting_attendant`, `called_attendant`, `waiting_doctor`, and `called_doctor` for the current business day.
- The real bug was in the reset contract itself.
- The previous cleanup only:
  - moved `called_attendant` back to `waiting_attendant`
  - moved `called_doctor` back to `waiting_doctor`
  - deleted `calls`
- Because the waiting queues were preserved, the three operational panels kept rendering the same current-day tickets even after the reset, which made the cleanup look partial or broken.

## Technical decision
- No persistent reset marker already existed in the repository or current schema contract.
- To keep the fix small and compatible with the current architecture, the cleanup contract was changed to invalidate the visible operational batch directly:
  - all current-day tickets in `waiting_attendant`
  - all current-day tickets in `called_attendant`
  - all current-day tickets in `waiting_doctor`
  - all current-day tickets in `called_doctor`
- Those tickets are now transitioned to `finished`, with `finished_at` set and operational call fields cleared.
- Current-day `calls` are still deleted so the visual history is emptied as well.

## Files changed in this task
- `src/app/api/admin/panels/reset/route.ts`
- `src/app/api/admin/panels/reset/route.test.ts`
- `src/features/admin/AdminScreen.tsx`
- `src/features/admin/AdminScreen.test.tsx`
- `src/features/admin/operationsApi.ts`
- `workflow/RUN_LOGS/2026-04-08-admin-clear-operational-panels-followup-fix.md`

## What changed
- The admin reset route now finishes all operational tickets from the current business day instead of sending active tickets back to waiting stages.
- The admin client response was simplified to a single `clearedOperationalTickets` count plus `clearedRecentCalls`.
- The admin success and confirmation copy now explicitly says the visible operational tickets of the day are ended, not returned to the queue.
- Added a route test covering the real regression scenario: waiting and called tickets from the current day are all invalidated so the panels stay empty until new tickets are created.

## Validation performed
- `npm run lint` -> passed
- `npm run test:run` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed

## What is now working
- After `Limpar painis de atendimento`, `/painel-chamada` stops showing old current-day calls and waiting tickets.
- After the same reset, `/atendente` no longer shows current or waiting tickets from the cleared operational batch.
- After the same reset, `/medico` no longer shows current or waiting tickets from the cleared operational batch.
- If no new tickets are generated after the reset, the three operational panels stay empty and consistent.
- New tickets generated after the reset still enter the normal queue flow because only the cleared operational batch is finished.

## Out of scope
- No change to the normal totem, attendant, or doctor calling flow
- No new global settings table or reset marker storage
- No broader refactor of dashboard metrics or historical reporting
