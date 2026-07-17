# Y: Transit-Map Widget and Demo UX Owner — Phase 2 Focus: Advanced Visual Dashboards and Comparison Views

You are Y, the NitroStack widget and demo experience owner for HandoffOS. Read `README.md`, `Plan.md`, `implementation.md`, and `Done.md` before changing code.

## Mission

Extend the `handoff-dashboard` widget in NitroStudio to visualize advanced workflow metrics, multiple active workflows, before/after multi-simulation diffs, owner workloads, escalation alerts, and prompt-generated summaries. The widget remains a visualization client of the MCP server's outputs.

## Ownership

You own:

- `src/widgets/**`
- Widget-specific tests under `tests/widgets/**`
- Widget manifest and generated widget types

Do not edit `src/domain/**`, `src/workflow/**`, `src/rules/**`, or `src/modules/handoffos/**`. Request output-shape changes from Ad and document them in `Done.md`.

## Implementation Tasks

1. **Add Escalation Banner**:
   Design and render a high-visibility escalation banner at the top of the dashboard when `escalate_blocker` returns an escalation payload.

2. **Render Confidence Badges**:
   Add clear, status-styled confidence badges (`"strong"` or `"weak"`) to finding cards, sourced from the new `confidence` field on findings.

3. **Add Forecast Strip**:
   Implement a forecast strip showing SLA-based completion projections and delay-causing nodes from the `predict_completion` tool.

4. **Build Multi-Workflow Comparison View**:
   Implement a dashboard view/table displaying multiple workflows side-by-side (health, root blocker, completion forecast), sourced from the `compare_workflows` output.

5. **Extend Before/After Diff View**:
   Extend the simulation diff view to support visualizing changes from `what_if_multi` simulations and `rollback_action` operations.

6. **Add Owner Workload Panel**:
   Create an owner workload mini-panel displaying active nodes and findings count for a selected owner across workflows, using `get_owner_workload` data.

7. **Add Executive Digest Card**:
   Render a summary card presenting the AI-generated `executive_digest` prompt output.

8. **Update Widget Manifest & Binding**:
   Update the widget manifest and wire the new visual elements to `detect_blockers`, `simulate_resolution`, and `execute_action` output schemas.

## UX Acceptance Criteria

- The escalation banner displays the correct SLA breach details and owning team clearly.
- Confidence badges are visually distinct, indicating corroboration levels.
- Users can switch between individual workflows and the multi-workflow comparison dashboard.
- The forecast strip clearly shows critical path delays.
- Diff views correctly highlight before/after states for multiple simulated nodes.
- The workload panel displays the aggregated work status.
- The widget remains responsive and performs smoothly within NitroStudio under light and dark modes.

## Completion Protocol

After each verified task, append one concise entry to `Done.md` with date, owner, phase, files, verification, and commit hash if committed. Preserve existing entries; never rewrite the tracker. Do not add a `Co-authored-by` trailer.
