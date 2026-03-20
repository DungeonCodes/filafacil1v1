# Backlog

## Completed stages
- Base Next.js + TypeScript + Tailwind application scaffolded.
- Supabase browser client wired with static env access.
- `/totem` implemented against live Supabase queues and `create_next_ticket`.
- `/painel-chamada` implemented with polling, current call, recent calls, and waiting queue.
- `/atendente` implemented with queue selection, call next, recall, and forward-to-doctor flows.
- `/medico` implemented with queue selection, consulting room selection, call next, recent calls, and finish flow.
- `/admin` implemented with KPIs and Recharts dashboard.
- Shared top navigation added across main screens.
- Authentication and role-based access control implemented.
- Admin user management implemented in `/admin`.
- Accessibility Phase 1 implemented: high contrast.
- Accessibility Phase 2 implemented: audio announcements in `/painel-chamada`.
- Accessibility Phase 3 implemented: guided voice mode in `/totem`.
- `/totem` visual refinement completed with emphasis on generated ticket card.

## Current in-progress stage
- No product feature is currently marked in progress from repository state.

## Next recommended phases

### Priority 1 - Version missing base Supabase schema
- Export and commit SQL for:
  - `queues`
  - `tickets`
  - `calls`
  - queue flow RPC functions
- Goal: remove dependency on undocumented external Supabase project state.

### Priority 2 - Add coverage for auth and accessibility flows
- Add tests for:
  - login redirect behavior
  - role guard behavior
  - admin user management routes or client flows
  - panel audio announcement change detection
  - totem guided voice flow state transitions

### Priority 3 - Security hardening review
- Reassess which data mutations should remain browser-direct and which should move server-side.
- Review Supabase RLS assumptions for `queues`, `tickets`, `calls`, and `app_users`.

### Priority 4 - Accessibility rollout beyond current focus
- Extend high-contrast affordances beyond `/totem`.
- Decide whether internal screens also need toggle placement and styling adjustments.
- Evaluate whether guided voice should remain totem-only or gain related assistive controls elsewhere.

## Known gaps
- No versioned seed script.
- No versioned base schema for queue domain tables/RPCs.
- No end-to-end test coverage.
