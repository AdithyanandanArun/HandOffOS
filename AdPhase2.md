# Ad: Integration and MCP Lead — Phase 2 Focus: Tool Expansion, Rollback Controls, and Executive Prompts

You are Ad, the integration owner for HandoffOS. Read `README.md`, `Plan.md`, `implementation.md`, and `Done.md` before changing code.

## Mission

Expand the HandoffOS MCP surface to support advanced operational tools (escalation, forecasting, comparisons, multi-simulations, rollbacks, and subscriptions) and evidence-grounded generative prompts. The MCP server remains the product's primary surface; all widget capabilities depend on the schemas defined here.

## Ownership

You own:

- `src/app.module.ts`
- `src/index.ts`
- `src/modules/handoffos/**`
- `src/application/**`
- Root scripts and NitroStack configuration when integration requires them
- MCP integration tests under `tests/mcp/**`

Do not implement G's domain store, Am's rule engine, or Y's widget UI. Import their public interfaces instead.

## Implementation Tasks

1. **Expose New MCP Tools**:
   - `escalate_blocker`: Detects an overdue/blocked node and returns a structured escalation payload (owning team, SLA breach details, evidence).
   - `predict_completion`: Returns a deterministic forecast of completion dates and critical path bottlenecks. Backed by Am's `predictCompletion`.
   - `compare_workflows`: Returns side-by-side analysis (health, root blocker, completion estimates) across multiple workflows. Backed by G's `listWorkflowIds` and `getStates`.
   - `rollback_action`: Undoes the last state-changing action, restoring the previous snapshot. Requires an approving identity and appends to the audit log. Backed by G's `getPreviousState`.
   - `what_if_multi`: Returns simulation results (before/after health, findings delta) of resolving multiple nodes at once. Backed by Am's `simulateMultiResolution`.
   - `get_owner_workload`: Aggregates active nodes and findings assigned to a specific owner across workflows. Backed by G's `getOwnerWorkload`.
   - `subscribe_alerts`: Registers a mocked alert subscription (workflowId, metric, threshold, comparator, subscriberId). Backed by G's subscription store.
   - `export_audit_report`: Combines current state, findings, and audit log into a structured JSON/Markdown compliance report.

2. **Expose New MCP Prompts**:
   - `escalation_email`: Drafts an escalation email to the blocking team, grounded in `escalate_blocker` output.
   - `executive_digest`: Generates a one-paragraph summary of multiple workflows for leadership, based on `compare_workflows` output.
   - `root_cause_narrative`: Connects rules and evidence into a coherent explanation of why a delay occurred.
   - `onboarding_readiness_check`: Evaluates if a person is ready to start based on workflow state, returning "not enough evidence" if required conditions are incomplete.

3. **Define Zod Schemas**:
   Define TypeScript interfaces, Zod schemas, and structured output formats for all new tools.

4. **Verify Prompt Grounding**:
   Ensure all prompt templates are strictly evidence-grounded and do not invent operational facts or write state.

5. **Write Integration Tests**:
   Write tests covering the new tools, verifying validation schemas, state-mutation checks (approver requirements), error handling, and prompt results.

## Integration Contract

- Tools that mutate state (`execute_action`, `rollback_action`) must require and record an approver identity.
- Simulation and query tools must not mutate the workflow store.
- Return both machine-readable structured JSON data and clear, formatted text. Attach the widget views to the tool outputs once Y provides the widget code.

## Acceptance Criteria

- The MCP server successfully exposes 8 additional tools and 4 additional prompts.
- `rollback_action` successfully restores state and adds to the audit log.
- `compare_workflows` properly summarizes multiple active workflows side-by-side.
- Prompts do not hallucinate facts outside the provided context and evidence.
- Integration tests in `tests/mcp/**` pass with a clean run.

## Completion Protocol

After each verified task, append one concise entry to `Done.md` with date, owner, phase, files, verification, and commit hash if committed. Preserve existing entries; never rewrite the tracker. Do not add a `Co-authored-by` trailer.
