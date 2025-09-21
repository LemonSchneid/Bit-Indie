# AGENTS.md

These guidelines apply to the entire repository. Read them before writing or modifying any code.

---

## Coding Standards

* Place all imports at the top of each file; avoid local or inline imports unless preventing circular dependencies.
* Never use blanket exception handlers (e.g., `except Exception`). Catch specific exceptions and fix underlying problems instead of hiding errors.
* Write docstrings for every class and for any function or method that touches gameplay logic or finite-state-machine (FSM) behavior. Small utilities and constants may use inline comments.
* Keep functions focused on a single task and prefer refactoring to piling on quick fixes or runtime hacks.

---

## Testing

* Provide automated tests for every critical function. Put tests under `tests/` with filenames like `test_<module>_<feature>.py`.
* Mock or stub UI- or state-heavy dependencies so tests stay targeted and reliable.
* All tests must pass before a change is considered complete.

---

## Workflow Expectations

* Work on feature branches (e.g., `feature/combat-refactor`, `fix/cooldown-bug`) and avoid committing directly to main.
* Use descriptive commit messages prefixed with a type such as `feat:`, `fix:`, `refactor:`, or `test:`.
* Summaries in pull requests should clearly explain the change set and call out any updates to gameplay logic or FSM states.

---

## AI Collaboration

* Do not invent context—ask for missing information or source code when uncertain.
* Demand accuracy and precision from AI-generated suggestions; validate everything against project standards.

---

## Codex Workflow Integration

* Codex agents must follow the workflow defined in `CONTRIBUTING.md` and use **`MVPBUILDPLAN.md`** as the source of truth for milestones and tickets **when** the plan's `ai_enforce_mvp_flow` flag is set to `true`.
* If `ai_enforce_mvp_flow = false`, agents may tackle other human-directed work while still complying with repository standards and any specific instructions provided for the touched areas.
* When the flag is `true`, always:

  1. Locate the next open ticket in `MVPBUILDPLAN.md` (the first without a `✅ Done`).
  2. Implement only that ticket, meeting all Acceptance Criteria.
  3. Mark the ticket as complete by appending `✅ Done` in `MVPBUILDPLAN.md`.
  4. Open a pull request with clear title and body referencing the ticket ID, milestone, and implementation details.
  5. Stop after opening the PR and wait for human review/merge.
* Never skip ahead or alter milestone order when enforcement is on.
* Treat `MVPBUILDPLAN.md` as the authoritative backlog. During the Simple‑MVP phase (Nostr off), prioritize tasks that keep Nostr integrations disabled behind feature flags; do not delete Nostr code.

---

## Simple‑MVP Direction (Nostr Off)

* Default to `NOSTR_ENABLED=false` (API) and `NEXT_PUBLIC_NOSTR_ENABLED=false` (web).
* Do not introduce new Nostr-facing dependencies in runtime paths.
* Preserve Nostr modules and tests; gate via flags or no‑op adapters.
* Focus on Lightning purchases, first‑party comments/reviews, developer settings, and moderation.

---

**Following this ensures steady progress, clean history, and human oversight while Codex contributes effectively.**
