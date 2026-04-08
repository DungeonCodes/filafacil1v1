# Run Log - 2026-04-08 - Atendente Finish Initial Attendance

## Purpose
Remove the explicit doctor forwarding choice from `/atendente` and replace it with a smaller, safer "Finalizar atendimento" action that keeps the existing medical flow compatible.

## Reference inputs used
- `workflow/SESSION_START.md`
- `workflow/PROJECT_CONTEXT.md`
- `workflow/ARCHITECTURE.md`
- `workflow/DB_SCHEMA.md`
- `workflow/DECISIONS.md`
- `workflow/BACKLOG.md`
- `src/features/atendente/AtendenteScreen.tsx`
- `src/features/atendente/api.ts`
- `src/features/atendente/types.ts`
- `src/features/atendente/AtendenteScreen.test.tsx`
- `src/features/medico/MedicoScreen.tsx`
- `src/features/medico/api.ts`
- `src/features/medico/types.ts`

## Files changed in this task
- `src/features/atendente/AtendenteScreen.tsx`
- `src/features/atendente/api.ts`
- `src/features/atendente/types.ts`
- `src/features/atendente/AtendenteScreen.test.tsx`
- `workflow/RUN_LOGS/2026-04-08-atendente-finish-initial-attendance.md`

## What changed
- Removed the `Encaminhar para` select from the attendant panel.
- Replaced the `Encaminhar` button with `Finalizar atendimento`.
- Renamed the attendant-side handler and API wrapper to reflect finalizing the initial attendance instead of explicit forwarding.
- Kept the existing Supabase RPC contract behind the scenes so the ticket still enters the doctor flow already used by `/medico`.
- Updated the attendant test to assert that the forwarding select is gone and the new action is called instead.

## Ticket transition after finalization
- Before finalization: the current ticket is in `called_attendant`.
- After `Finalizar atendimento`: the attendant UI hands the ticket off through the existing doctor-flow RPC, so it leaves the initial attendance state and becomes available for the medical queue flow consumed by `/medico`.
- The doctor still chooses the consultorio at doctor call time through the existing `/medico` flow.

## Validation performed
- `npm run lint` -> passed
- `npm run test:run` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed

## What is now working
- The attendant no longer chooses consultorio or doctor during the initial attendance.
- The attendant can finish the current initial attendance without changing the existing doctor-side queue flow.
- Polling, current ticket display, next call, and recall behavior remain intact.

## Out of scope
- No backend or Supabase SQL changes
- No changes to `/medico` beyond compatibility verification
- No change to auth, roles, layout, or queue-calling rules outside the attendant handoff action
