# Next Recommended Phase

## Title
Version and document the missing queue-domain Supabase schema.

## Why this is next
- The app currently depends on external, undocumented SQL objects for core queue behavior.
- Further product/backend work remains fragile until those objects are versioned in the repo.
- This is the largest continuity gap still present after the current implementation stages.

## Scope
- Export and commit SQL for:
  - `queues`
  - `tickets`
  - `calls`
  - `create_next_ticket`
  - `call_next_attendant`
  - `forward_ticket_to_doctor`
  - `call_next_doctor`
- Document any RLS or privilege assumptions.
- Align `workflow/DB_SCHEMA.md` with the newly versioned SQL once added.

## Non-goals
- Do not redesign product behavior while doing this extraction.
- Do not refactor feature screens in the same step unless required to match actual DB contracts.

## Acceptance target
- A fresh future session can understand and reproduce the full Supabase shape from repository files alone.
