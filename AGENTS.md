AGENTS.md
These guidelines apply to the entire repository. Read them before writing or modifying any code.

Coding Standards
Place all imports at the top of each file; avoid local or inline imports unless preventing circular dependencies.
Never use blanket exception handlers (e.g., except Exception). Catch specific exceptions and fix underlying problems instead of hiding errors.
Write docstrings for every class and for any function or method that touches gameplay logic or finite-state-machine (FSM) behavior. Small utilities and constants may use inline comments.
Keep functions focused on a single task and prefer refactoring to piling on quick fixes or runtime hacks.

Testing
Provide automated tests for every critical function. Put tests under tests/ with filenames like test_<module>_<feature>.py.
Mock or stub UI- or state-heavy dependencies so tests stay targeted and reliable.
All tests must pass before a change is considered complete.

Workflow Expectations
Work on feature branches (e.g., feature/combat-refactor, fix/cooldown-bug) and avoid committing directly to main.
Use descriptive commit messages prefixed with a type such as feat:, fix:, refactor:, or test:.
Summaries in pull requests should clearly explain the change set and call out any updates to gameplay logic or FSM states.

AI Collaboration
Do not invent context—ask for missing information or source code when uncertain.
Demand accuracy and precision from AI-generated suggestions; validate everything against project standards.
