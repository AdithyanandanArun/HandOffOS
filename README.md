# HandoffOS

> **HandoffOS makes invisible enterprise handoffs visible, explainable, and actionable.**

**Rules detect. AI explains. MCP acts.**

HandoffOS is a Workflow Intelligence Engine exposed through MCP. It reconstructs work that crosses enterprise systems, detects blockers with deterministic rules, shows the evidence behind every finding, simulates approved resolutions, and updates the workflow state when an action is executed.

The first demo workflow is **new-hire onboarding** for Priya Nair:

```text
Manager Approval -> HR Verification -> Laptop Allocation -> Identity Access
                  -> VPN Setup -> Developer Access -> Orientation
```

Priya joins Monday. Manager approval and HR verification are complete, but the laptop task was never created. HandoffOS identifies Laptop Allocation as the root blocker, proves why it matters, predicts the impact, and coordinates the next approved action.

## Why HandoffOS

Enterprise work is rarely blocked inside a single application. It stalls in the gaps between HR, IT, procurement, task boards, calendars, and email. Each system holds a partial signal; HandoffOS turns those signals into one live, explainable workflow state.

The dashboard is a client, not the product. The core capability is a reusable MCP server that can be used through NitroStudio, Claude, ChatGPT, or any other compatible client.

## MCP Surface

Resources:

```text
workflow://onboard-priya/state
workflow://onboard-priya/events
workflow://onboard-priya/findings
workflow://onboard-priya/audit-log
workflow://rules
```

Tools:

```text
ingest_event
detect_blockers
simulate_resolution
plan_next_actions
execute_action
```

Prompts:

```text
explain_blocker
manager_summary
```

## Demo Story

1. Inspect Priya's workflow state and rules through MCP.
2. Run blocker detection to identify Laptop Allocation as the root blocker.
3. Open evidence and see exactly which deterministic rules fired.
4. Simulate IT completing the laptop allocation today.
5. Review the improved health score, completion estimate, and critical path.
6. Execute an approved action and watch the transit-map workflow update with a new audit entry.

## Stack

- [NitroStack](https://nitrostack.ai/) for the MCP server, tools, resources, prompts, and widgets
- TypeScript with Zod schemas for deterministic, validated contracts
- NitroStudio as the primary local demo and MCP testing surface
- NitroCloud as the deployment target

## Status

Phases 1 through 4 are implemented for the seeded Priya onboarding demo: the NitroStack MCP surface is wired to deterministic workflow state, rules, simulation, approved execution, audit history, and the transit-map output contract. The full product plan is in [Plan.md](Plan.md), and the phased implementation checklist is in [implementation.md](implementation.md).

The repeatable judge flow is in [DEMO.md](DEMO.md).

Team ownership and the shared progress tracker are documented in [Ad.md](Ad.md), [Y.md](Y.md), [Am.md](Am.md), [G.md](G.md), and [Done.md](Done.md).

## Local Development

Once Phase 1 dependencies are installed:

```bash
npm run dev
```

Use NitroStudio to inspect MCP resources, call tools, preview widgets, and test the demo flow.

## Principle

AI never invents operational facts. Deterministic rules establish the workflow state, findings, evidence, and risk. AI is limited to explaining that grounded information.
