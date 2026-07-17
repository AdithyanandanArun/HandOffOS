# MCP Integration Test Scaffold

Ad owns integration tests in this directory. Add tests when G's `WorkflowPort` implementation and Am's `AnalysisPort` implementation are available.

Required coverage:

- Resource discovery returns the five workflow URIs.
- Tool schemas reject invalid input before application services run.
- `simulate_resolution` does not mutate the live workflow store.
- `execute_action` rejects unplanned or unapproved actions.
- An approved action appends an audit entry and returns recalculated state.
- Both prompts direct the model to evidence resources and prohibit invented facts.

Tests must construct `HandoffOSApplication` with in-memory mock ports. Do not depend on a live LLM, NitroStudio session, or external enterprise account.
