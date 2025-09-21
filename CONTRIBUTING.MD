# Contributing — Codex Workflow

This repository uses **Codex agents** (AI coding assistants) as junior developers. To keep them on track, follow this strict workflow.

---

## Source of truth: MVPBUILDPLAN.md

* The file `MVPBUILDPLAN.md` contains all milestones and tickets.
* Each ticket has:

  * Milestone (M0–M6)
  * Ticket ID (e.g., 0.1, 1.2)
  * Labels, estimate
  * Description, Acceptance Criteria, Tasks
* We are currently in a Simple‑MVP phase with `ai_enforce_mvp_flow = false`.
* Use the plan to align scope and priorities; humans may resequence work as needed.

---

## Codex workflow

1. **Confirm scope**

   * Open `MVPBUILDPLAN.md` and confirm the task aligns with the Simple‑MVP milestones.

2. **Open a Pull Request**

   * Title: `[Ticket X.Y] {short description}`
   * Body: Include:

     * Ticket ID & Milestone
     * What was implemented
     * How Acceptance Criteria were satisfied
     * Any notes for human review

3. **Wait for review**

   * Do not proceed to additional scope without human approval.

---

## Human-in-the-loop

* A human maintainer reviews every PR.
* If the PR passes review, it is merged.
* If changes are required, Codex is instructed to revise the same PR.
* After merge, the next Codex run starts at the next unmarked ticket.

---

## Example flow

* Codex Run #1 → Implements 0.1 (Monorepo scaffolding) → marks `✅ Done` → PR opened → human merges.
* Codex Run #2 → Sees 0.1 is done → works on 0.2 (DB init) → PR opened → merge.
* Repeat until all milestones complete.

---

## Rules for Codex

* Never modify unrelated files unless required by the ticket.
* Never mark tickets as done unless **fully implemented and tested**.
* Keep changes aligned with the "Nostr‑off MVP" direction.
* Do not re‑enable Nostr features or services without explicit instruction.

---

## Human guidelines

* Keep `MVPBUILDPLAN.md` updated with clarifications as needed.
* Use GitHub labels/milestones to mirror progress if desired.
* Treat Codex like a disciplined intern: one ticket at a time, supervised.

---

**This workflow ensures steady progress, auditable commits, and clean human oversight.**
