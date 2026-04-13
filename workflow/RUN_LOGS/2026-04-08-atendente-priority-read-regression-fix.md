# Run Log - 2026-04-08 - Attendant Priority Read Regression Fix

## Purpose
Restore `/atendente` queue visibility after the introduction of `is_priority`, without removing the approved priority behavior from `/totem` or the operational call order.

## Reference inputs used
- `workflow/SESSION_START.md`
- `workflow/PROJECT_CONTEXT.md`
- `workflow/ARCHITECTURE.md`
- `workflow/DB_SCHEMA.md`
- `workflow/DECISIONS.md`
- `AGENTS.md`
- `src/features/totem/api.ts`
- `src/features/totem/types.ts`
- `src/app/api/totem/tickets/route.ts`
- `src/features/atendente/api.ts`
- `src/lib/tickets/callNextWithPriority.ts`

## Scope
- Fix `/atendente` snapshot reads after `is_priority`
- Preserve phase 1 priority persistence in `/totem`
- Preserve phase 2 priority ordering in operational call-next
- Keep compatibility with legacy rows and partially migrated environments
- No UX or flow change in `/medico`, `/painel-chamada`, or `/admin`

## Root cause
- The phase-2 priority work introduced a hard dependency on `tickets.is_priority` in two read paths used by `/atendente`:
  - the attendant snapshot query
  - the shared `callNextWithPriority` helper
- In environments where the `is_priority` column was not yet fully available to the database/schema cache, those reads could fail before the queue snapshot was assembled, making `/atendente` appear empty.
- Legacy rows with `is_priority = null` also needed to be treated as non-priority so they would not be promoted incorrectly in priority-first ordering.

## What changed
- Added `src/lib/tickets/prioritySupport.ts` to centralize:
  - detection of missing/unavailable `is_priority` column errors
  - the shared priority ordering contract with `nullsFirst: false`
- Updated `src/features/atendente/api.ts` so `loadAttendantSnapshot`:
  - first attempts to read with `is_priority`
  - falls back to a legacy-safe select when the priority column is unavailable
  - continues normalizing missing or `null` priority values as `false`
- Updated `src/lib/tickets/callNextWithPriority.ts` so operational call-next:
  - keeps priority-first ordering when `is_priority` is available
  - falls back to FIFO-only lookup when the column is unavailable
  - preserves the existing called-stage transition logic
- Added focused regression coverage for:
  - attendant queue reads with priority available
  - attendant queue reads when the priority column is unavailable
  - legacy rows with `is_priority = null`
  - shared call-next fallback behavior

## Files changed in this task
- `src/lib/tickets/prioritySupport.ts`
- `src/lib/tickets/callNextWithPriority.ts`
- `src/lib/tickets/callNextWithPriority.test.ts`
- `src/features/atendente/api.ts`
- `src/features/atendente/api.test.ts`
- `workflow/RUN_LOGS/2026-04-08-atendente-priority-read-regression-fix.md`

## Validation performed
- `npm run lint` -> passed
- `npm run test:run` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed

## What is now working
- `/atendente` reads and displays the initial waiting queue again after the priority introduction.
- `/atendente` still reads and displays the current initial attendance ticket when present.
- Priority ordering remains active where `is_priority` is available.
- Legacy tickets without explicit priority are treated as normal tickets.
- Operational flow remains compatible with the existing priority phase 1 and phase 2 behavior.

## Out of scope
- No change to the `/totem` priority selection UX
- No change to `/medico`, `/painel-chamada`, or `/admin` behavior beyond preserving compatibility
- No new database migration beyond the already documented `is_priority` phase
