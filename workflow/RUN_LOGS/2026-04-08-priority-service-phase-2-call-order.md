# Run Log - 2026-04-08 - Priority Service Phase 2 Call Order

## Purpose
Make priority tickets (`is_priority = true`) be called before normal tickets in the operational flow, while preserving FIFO inside each priority group and keeping the rest of the system behavior unchanged.

## Reference inputs used
- `workflow/SESSION_START.md`
- `workflow/PROJECT_CONTEXT.md`
- `workflow/ARCHITECTURE.md`
- `workflow/DB_SCHEMA.md`
- `workflow/DECISIONS.md`
- `AGENTS.md`
- `src/features/atendente/api.ts`
- `src/features/medico/api.ts`
- `src/features/painel-chamada/api.ts`
- `src/lib/tickets/formatTicket.ts`

## Scope
- Priority ordering in `/atendente`
- Priority ordering in `/medico`
- Matching visual ordering in operational waiting lists
- `P` marker display in operational ticket labels where applicable
- No change to `/totem` generation flow
- No change to admin cleanup rules

## What changed
- Replaced the previous dependency on external `call_next_attendant` / `call_next_doctor` ordering with a shared app-side helper:
  - `src/lib/tickets/callNextWithPriority.ts`
- The shared helper now:
  - blocks calling a new ticket when the same operational scope already has one in progress
  - finds the next waiting ticket by `ticket_date`, `prefix`, and stage
  - orders by `is_priority desc`
  - then orders by `created_at asc`
  - updates the ticket into the called stage
  - inserts the corresponding `calls` row
- Updated attendant and doctor feature APIs to use that shared helper instead of relying on unversioned RPC ordering.
- Updated attendant, doctor, and public panel snapshot queries to include `is_priority`.
- Updated waiting queues in attendant, doctor, and public panel to reflect the same priority-first ordering visually.
- Updated ticket formatting calls in operational screens so priority tickets display with `P` where those screens already render ticket labels.

## Where the priority rule lives now
- Core rule lives in `src/lib/tickets/callNextWithPriority.ts`
- Snapshot ordering mirrors the same rule in:
  - `src/features/atendente/api.ts`
  - `src/features/medico/api.ts`
  - `src/features/painel-chamada/api.ts`

## Files changed in this task
- `src/lib/tickets/callNextWithPriority.ts`
- `src/lib/tickets/callNextWithPriority.test.ts`
- `src/features/atendente/api.ts`
- `src/features/atendente/api.test.ts`
- `src/features/atendente/types.ts`
- `src/features/atendente/AtendenteScreen.tsx`
- `src/features/atendente/AtendenteScreen.test.tsx`
- `src/features/medico/api.ts`
- `src/features/medico/api.test.ts`
- `src/features/medico/types.ts`
- `src/features/medico/MedicoScreen.tsx`
- `src/features/medico/MedicoScreen.test.tsx`
- `src/features/painel-chamada/api.ts`
- `src/features/painel-chamada/types.ts`
- `src/features/painel-chamada/PainelChamadaScreen.tsx`
- `workflow/SESSION_START.md`
- `workflow/PROJECT_CONTEXT.md`
- `workflow/ARCHITECTURE.md`
- `workflow/DECISIONS.md`
- `workflow/RUN_LOGS/2026-04-08-priority-service-phase-2-call-order.md`

## Validation performed
- `npm run lint` -> passed
- `npm run test:run` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed

## What is now working
- Attendant call-next now prefers priority tickets before normal ones in the same queue.
- Doctor call-next now prefers priority tickets before normal ones in the same queue.
- FIFO remains intact inside each priority bucket through `created_at asc`.
- Operational waiting lists now visually match the same priority-first order.
- Priority tickets now keep the `P` marker in attendant, doctor, and panel views where ticket labels are shown.

## Out of scope
- No change to `/totem` ticket creation UX in this task
- No change to admin reset semantics
- No extraction/versioning of the missing base queue RPC SQL beyond the documented workaround
