# Session Start

## Current project state
- Main routes are implemented and render through App Router.
- Auth and role guards are in place.
- Accessibility phases 1, 2, and 3 are present in code.
- Admin dashboard includes user management.
- Public queue schema SQL is only partially versioned in the repo.
- Priority tickets exist in `/totem` and now drive call ordering in `/atendente` and `/medico`.

## Latest completed implementation phase
- Priority service Phase 2: priority tickets are called before normal tickets in attendant and doctor flows.

## Next recommended implementation phase
- Version the missing base Supabase schema and queue RPC SQL into the repository before further backend changes.

## Critical product rules
- Anonymous flow must keep `/totem` available.
- Internal routes require authentication.
- Ticket display formatting must remain app-side (`formatTicket`).
- Ticket flow stages currently used in code:
  - `waiting_attendant`
  - `called_attendant`
  - `waiting_doctor`
  - `called_doctor`
  - `finished`

## Critical workflow rules
- Read all workflow files before proposing work.
- Validate actual repository state before assuming the next phase.
- Keep workflow docs updated after substantial implementation or validation.
- Do not assume missing SQL objects are versioned unless they exist in `supabase/`.

## Safe local validation order
1. `npm run lint`
2. `npm run test:run`
3. `npm run build`
4. `npm run typecheck`

This order avoids the local `.next/types` issue seen when running `typecheck` first in this workspace.
