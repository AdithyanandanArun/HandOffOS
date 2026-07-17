# HandoffOS Product and Architecture Plan

## Product

HandoffOS is an enterprise Workflow Intelligence Engine exposed through MCP. It makes work that is invisible between teams visible, explainable, and actionable.

The product is not an enterprise chatbot and it is not an HR onboarding application. The new-hire onboarding scenario proves a reusable workflow engine based on nodes, dependencies, owners, SLAs, evidence, actions, and audit history.

The first workflow follows Priya Nair's onboarding journey:

```text
Manager Approval
  -> HR Verification
  -> Laptop Allocation
  -> Identity Access
  -> VPN Setup
  -> Developer Access
  -> Orientation
```

Manager approval and HR verification are complete. Laptop Allocation is missing, so downstream work is blocked. HandoffOS must make that root cause immediately clear.

## Architecture

```text
Mock enterprise events
  -> Event store
  -> Workflow state builder
  -> Deterministic rules engine
  -> Evidence and simulation
  -> Approved actions
  -> Updated workflow state
  -> MCP resources, tools, prompts, and widget
```

NitroStack is the only MCP framework. Its CLI creates the TypeScript project, its decorators define MCP contracts, and its widget system renders the dashboard in NitroStudio. The MCP server remains the product surface; the dashboard is a first-class client rather than a proprietary backend.

## Workflow Model

Every workflow node has an ID, label, owner, status, dependencies, SLA, and optional completion time. Node statuses are:

```text
completed | blocked | pending | ready | in_progress
```

The workflow state contains the graph, current findings, main blocker, health score, estimated completion, event evidence, and audit history.

## Rules and Evidence

The rules engine produces facts. AI may explain a fact but must never create one.

| Rule | Meaning |
| --- | --- |
| R-001 | Missing Owner |
| R-002 | Missing Dependency |
| R-003 | SLA Overdue |
| R-004 | Missing Document |
| R-005 | Critical Path Blocked |
| R-006 | Approval Stale |
| R-007 | Calendar Missing |

Each finding includes the rule ID, severity, affected nodes, evidence IDs, and risk points. Evidence must show the relevant source event or the absence of a required event/task.

## Health and Simulation

Health is calculated rather than invented:

```text
health = max(0, 100 - total risk points)
```

The seeded demo starts at 62. Risk points are deterministic:

- Blocked node: 30
- SLA overdue: 20
- Critical-path block: 25
- Each blocked downstream node: 10

Simulation runs against a cloned state. It returns the before/after health score, estimated completion, new critical path, and findings resolved or introduced. It does not modify the live workflow.

## MCP Contract

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

`execute_action` is intentionally guarded by an approval input and an auditable approver identity. It only executes actions returned by `plan_next_actions`.

## Experience

The NitroStack widget is a transit map, not a generic node graph. Each workflow step is a station. The visual system makes state obvious:

- Green stations are complete.
- Red stations are blocked.
- Amber stations are ready or in progress.
- Gray stations are pending.

The main blocker is the hero card. Evidence, fired rules, simulation results, planned actions, and the audit log support it. When Laptop Allocation is executed, the downstream stations light up and the audit log updates.

## Constraints and Defaults

- Phase 1 uses an in-memory seeded state store. It resets on restart or redeploy.
- The state store is an abstraction so a durable store can replace it later without changing MCP contracts.
- NitroStudio is the primary demo surface, but all behavior is available to any MCP-compatible client through standard resources, tools, and prompts.
- No external enterprise accounts are required for the MVP; Gmail, HR, task-board, and calendar events are mocked and deterministic.
- NitroCloud is the deployment target. Deployment documentation must state the in-memory reset behavior.

## Success Criteria

- NitroStudio discovers all required resources, tools, prompts, and widget outputs.
- Laptop Allocation is detected as Priya's root blocker with evidence.
- The system displays rule IDs and the health-score formula.
- A simulation changes only projected state and improves health to 86.
- An approved action mutates live state, recalculates the graph, and appends to the audit log.
- The same MCP contract works without the widget.
