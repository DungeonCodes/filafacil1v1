# Decisions

## Active repository rules

### 2026-03-20 - Workflow files are the source of truth
- Future Codex sessions must use `workflow/` as the starting point.
- Repository state takes precedence over prior chat memory.

### 2026-03-20 - Validate repository state before proposing next work
- Before suggesting or implementing a next phase, inspect the codebase and current validation status.
- Do not assume an intended roadmap step is still pending if the repo already contains it.

### 2026-03-20 - Changes must stay incremental and scoped
- Keep feature changes localized to the existing architecture unless there is a demonstrated architectural blocker.
- Avoid broad refactors during feature delivery.

### 2026-03-20 - Validate before closing work
- Implementation results should be verified before being considered complete.
- Standard validation target:
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `npm run typecheck`

### 2026-03-20 - Local validation order caveat
- In this Windows workspace, `npm run typecheck` can fail if `.next/types` is stale or missing.
- Safe local order after a clean or partially cleaned workspace:
  1. `npm run build`
  2. `npm run typecheck`
- Keep CI order unchanged unless there is evidence CI is affected.

### 2026-03-20 - Authentication uses Supabase Auth plus app_users
- Password handling and sessions are delegated to Supabase Auth.
- Authorization is controlled by `public.app_users.role` and `public.app_users.is_active`.
- Default role landing pages:
  - `attendant` -> `/atendente`
  - `doctor` -> `/medico`
  - `admin` -> `/admin`

### 2026-03-20 - Accessibility uses browser-native APIs with fallback
- High contrast is a client-side preference persisted in `localStorage`.
- Public panel audio uses browser speech synthesis only.
- Totem guided voice uses browser speech synthesis + speech recognition only.
- If browser support is unavailable, the UI must fail safely without blocking core operation.

### 2026-03-20 - Missing base DB schema must be documented before backend changes
- The repository does not version the base SQL for `queues`, `tickets`, `calls`, or queue RPCs.
- Future backend work should first close this source-of-truth gap or explicitly work around it.

### 2026-04-08 - Priority call ordering lives in app-side shared logic
- Priority ordering for `call next` is now implemented in `src/lib/tickets/callNextWithPriority.ts`.
- The app orders by `is_priority desc` and then `created_at asc` for both attendant and doctor waiting flows.
- This avoids depending on external RPC ordering rules that are not versioned in the repository.
