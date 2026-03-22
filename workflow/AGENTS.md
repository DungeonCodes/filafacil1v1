# Workflow AGENTS

These workflow files are the repository source of truth for future Codex sessions.

## Required session-start reading order
1. `workflow/SESSION_START.md`
2. `workflow/PROJECT_CONTEXT.md`
3. `workflow/ARCHITECTURE.md`
4. `workflow/DB_SCHEMA.md`
5. `workflow/DECISIONS.md`
6. `workflow/BACKLOG.md`
7. Latest file in `workflow/RUN_LOGS/`
8. Relevant file in `workflow/TASKS/`

## Working rules
- Do not rely on previous chat context when resuming work.
- Validate the actual repository state before proposing the next step.
- Keep changes incremental, scoped, and consistent with the current architecture.
- Validate implementation results before marking work as complete.
- Update `workflow/` after any substantial implementation or validation pass.

## Documentation rules
- `workflow/` must reflect the repository as it exists now, not the intended future state.
- If repository state and prior assumptions conflict, repository state wins.
- Record important local quirks that affect safe resumption.
- Document missing but required external dependencies explicitly.

## Guardrails for future sessions
- Do not change product behavior while doing workflow hygiene unless a clear documentation inconsistency requires it.
- If database structure used by the app is not fully versioned in the repo, document the gap before changing backend behavior.
- If a new task starts from a clean workspace, re-check validation commands before assuming they still pass.
