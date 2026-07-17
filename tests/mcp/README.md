# MCP Integration Tests

Ad owns integration tests in this directory. They construct a fresh seeded `HandoffOSApplication` for every test and do not depend on a live LLM, NitroStudio session, or external enterprise account.

Required coverage:

- Resource discovery exposes the five workflow URIs, five tools, and two prompts.
- Tool schemas reject invalid input before application services run.
- `simulate_resolution` does not mutate the live workflow store.
- `execute_action` rejects unplanned or unapproved actions.
- An approved action appends an audit entry and returns recalculated state.
- Dashboard-linked tool responses conform to their structured output schemas.

Run all MCP and rules coverage with:

```bash
npm test
```
