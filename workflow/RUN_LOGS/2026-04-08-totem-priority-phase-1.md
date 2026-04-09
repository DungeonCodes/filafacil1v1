# Run Log - 2026-04-08 - Totem Priority Phase 1

## Purpose
Implement phase 1 of priority handling in `/totem` with a clear first-step choice between normal and priority service, persist the choice on the generated ticket, and display priority tickets with a `P` marker in the issued ticket label.

## Reference inputs used
- `AGENTS.md`
- `.agents/skills/totem-ui/SKILL.md`
- `design/totem-v2/README.MD`
- `design/totem-v2/visual-direction.md`
- `design/totem-v2/accessibility-notes.md`
- `design/totem-v2/future-references.md`
- `design/totem-v2/Captura de tela 2026-04-08 154236.png`
- `src/features/totem/TotemScreen.tsx`
- `src/features/totem/api.ts`
- `src/lib/tickets/formatTicket.ts`

## Scope
- Add a first-step UX choice in `/totem` for `Atendimento normal` vs `Atendimento prioritario`
- Keep the existing queue selection and ticket generation flow after that choice
- Persist a simple priority flag on the created ticket
- Do not implement priority ordering yet in `/atendente`, `/medico`, or `/painel-chamada`

## What changed
- Added a new step-1 block in `/totem` so the person must choose `Normal` or `Prioritario` before the queue cards appear.
- Kept the choice block directly below the global voice and contrast controls, with a stronger visual emphasis on the priority option.
- Updated the guided voice flow so it now asks for `normal` or `prioritario` before asking for the queue.
- Switched ticket creation from a direct browser RPC call to a small server route at `/api/totem/tickets`.
- The new route still uses the existing `create_next_ticket` RPC, then persists `is_priority` on the generated ticket using the server-side service-role client.
- Added the phase-1 schema artifact `supabase/tickets_priority_phase1.sql` to document the required `tickets.is_priority boolean not null default false` column.
- Updated ticket formatting so the display label gains a `P` before the existing prefix only when the ticket is priority, for example `PCG-003`.

## Technical contract
- Priority persistence is phase 1 only: `tickets.is_priority`
- No call-order changes were introduced
- Existing numbering stays unchanged; the `P` is a display marker added by `formatTicket(prefix, ticketNumber, digits, isPriority)`

## Files changed in this task
- `src/features/totem/TotemScreen.tsx`
- `src/features/totem/TotemScreen.test.tsx`
- `src/features/totem/api.ts`
- `src/features/totem/api.test.ts`
- `src/features/totem/types.ts`
- `src/app/api/totem/tickets/route.ts`
- `src/app/api/totem/tickets/route.test.ts`
- `src/lib/tickets/formatTicket.ts`
- `src/lib/tickets/formatTicket.test.ts`
- `supabase/tickets_priority_phase1.sql`
- `workflow/DB_SCHEMA.md`
- `workflow/RUN_LOGS/2026-04-08-totem-priority-phase-1.md`

## Validation performed
- `npm run test:run` -> passed
- `npm run lint` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed

## What is now working
- `/totem` now requires a first explicit choice between normal and priority service before showing the queue cards.
- The priority option is visually stronger and clearer in the first fold.
- Guided voice mode now includes the same first-step choice instead of skipping it.
- Ticket generation continues to work after the new choice step.
- Priority tickets now display with `P` before the existing prefix, without changing the ticket number sequence itself.

## Out of scope
- No priority ordering in attendant or doctor queues yet
- No changes to `/atendente`, `/medico`, or `/painel-chamada` display formatting in this task
- No broader schema extraction beyond the isolated `is_priority` phase-1 artifact
