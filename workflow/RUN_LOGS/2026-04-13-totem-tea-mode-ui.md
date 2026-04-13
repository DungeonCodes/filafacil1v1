# Run Log - 2026-04-13 - Totem TEA Mode UI

## Purpose
Add a client-side `Modo TEA` toggle to `/totem` that makes the experience calmer, more predictable, and more step-focused without changing operational logic, backend contracts, Supabase schema, RPC behavior, or ticket payloads.

## Reference inputs used
- `AGENTS.md`
- `.agents/skills/totem-ui/SKILL.md`
- `design/totem-v2/README.MD`
- `design/totem-v2/visual-direction.md`
- `design/totem-v2/accessibility-notes.md`
- `design/totem-v2/future-references.md`
- `workflow/SESSION_START.md`
- `workflow/PROJECT_CONTEXT.md`
- `workflow/ARCHITECTURE.md`
- `workflow/DECISIONS.md`
- `workflow/RUN_LOGS/2026-04-08-totem-v2-visual-refresh.md`
- `workflow/RUN_LOGS/2026-04-08-totem-v2-compact-top-refinement.md`
- `src/features/totem/TotemScreen.tsx`
- `src/features/totem/TotemScreen.test.tsx`

## Files changed in this task
- `src/features/totem/TotemScreen.tsx`
- `src/features/totem/TotemScreen.test.tsx`
- `workflow/RUN_LOGS/2026-04-13-totem-tea-mode-ui.md`

## What changed
- Added a third global top control on `/totem`: `Modo TEA`, independent from guided voice and high contrast.
- Persisted the TEA preference only in browser `localStorage`, using a safe client-only approach similar to the high-contrast preference.
- Kept all ticket-generation logic unchanged while adding TEA-specific UI treatment:
  - calmer neutral background and surfaces
  - reduced glows and gradients
  - clearer step emphasis
  - shorter supporting copy
  - more stable visual hierarchy
  - less secondary voice metadata when TEA mode is active
- Added a focused journey summary block in TEA mode to keep the current step obvious:
  - `Passo 1` type selection
  - `Passo 2` service selection
  - `Passo 3` generated ticket
- Kept the generated ticket as the dominant visual element even in the calmer TEA presentation.
- Added targeted `/totem` tests to cover the TEA toggle persistence and to confirm ticket generation still calls the same frontend contract when TEA mode is active.

## Backend and contract impact
- No database changes
- No Supabase schema changes
- No RPC changes
- No API contract changes
- No ticket payload changes
- No changes outside `/totem`

## Validation performed
- `npm run lint` -> passed
- `npm run test:run` -> passed
- `npm run build` -> passed
- `npm run typecheck` -> passed

## Validation note
- In this local Codex environment, `test:run` and `build` needed to be rerun outside the sandbox because the sandbox blocked child-process spawning used by `esbuild` and Next.js workers.
- Node.js and project dependencies were installed locally in order to complete the requested validation commands.

## What is now working
- `/totem` now exposes a visible `Modo TEA` toggle alongside `Voz` and `Contraste`.
- Turning on TEA mode makes the page visually calmer while preserving touch targets, contrast, and mobile-first behavior.
- TEA mode highlights the current step more clearly and reduces visible secondary information.
- Guided voice remains opt-in and independent.
- High contrast remains opt-in and compatible.
- Priority and normal ticket generation continue to work with the same frontend/backend contract.

## Out of scope
- No changes to `/atendente`
- No changes to `/medico`
- No changes to `/painel-chamada`
- No changes to `/admin`
- No database extraction or workflow roadmap changes
