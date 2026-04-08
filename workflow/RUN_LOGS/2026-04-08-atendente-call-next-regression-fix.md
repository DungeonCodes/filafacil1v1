# Run Log - 2026-04-08 - Atendente Call Next Regression Fix

## Purpose
Fix the `/atendente` regression where the panel stopped progressing to the next initial ticket after the change that removed manual forwarding and introduced `Finalizar atendimento`.

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

## Root cause
- The previous change kept the attendant finalization tied to `forward_ticket_to_doctor`.
- To satisfy that RPC from the new UI, the client started sending a fixed destination label (`Consultorio 001`).
- That reintroduced an implicit forwarding dependency into a flow that was supposed to stop choosing doctor destination in the attendant screen.
- When that handoff failed, the ticket stayed in `called_attendant`, so `call_next_attendant` correctly remained blocked by the still-active initial attendance.
- The apparent regression in `Chamar proximo` was therefore caused by the new finalization handoff, not by the button handler itself.

## Files changed in this task
- `src/features/atendente/api.ts`
- `src/features/atendente/api.test.ts`
- `src/features/atendente/AtendenteScreen.test.tsx`
- `workflow/RUN_LOGS/2026-04-08-atendente-call-next-regression-fix.md`

## What changed
- Replaced the attendant-side finish handoff from the forwarding RPC with a direct ticket transition from `called_attendant` to `waiting_doctor`.
- Cleared `current_consulting_room` and `called_at` during that transition so the ticket cleanly leaves the active attendant state.
- Preserved the existing `callNextAttendant`, `recallCurrentTicket`, polling, and screen structure.
- Added a targeted API test to lock the new transition contract.
- Added a component test covering the flow of finalizing the current ticket and then calling the next ticket.

## Validation performed
- `npm run lint` -> passed
- `npm run test:run` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed

## What is now working
- `/atendente` can finalize the current initial attendance without depending on manual forwarding.
- After finalization, the current ticket leaves `called_attendant`, which unblocks `Chamar proximo`.
- `Rechamar` continues using the existing called-attendant flow.
- `Finalizar atendimento` continues following the new rule and now transitions the ticket directly into the medical waiting flow.

## Out of scope
- No change to `/medico`
- No backend SQL extraction or RPC redesign
- No auth, layout, or accessibility changes
