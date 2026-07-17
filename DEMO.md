# HandoffOS Two-Minute Demo

## Setup

```bash
npm run dev
```

Connect NitroStudio to the local HandoffOS server. The in-memory Priya workflow resets whenever the server restarts.

## Story

1. Open with the problem:

   > Enterprise work gets stuck between teams. HandoffOS makes those handoffs visible, explainable, and actionable. Rules detect. AI explains. MCP acts.

2. Show the MCP surface:

   ```text
   workflow://onboard-priya/state
   workflow://rules
   workflow://onboard-priya/findings
   ```

   Point out that `workflow://onboard-priya/state` shows Priya's onboarding as a live workflow, not a disconnected list of tickets.

3. Call `detect_blockers`:

   ```json
   { "workflowId": "onboard-priya" }
   ```

   Show that Laptop Allocation is the root blocker, health is `62`, and the evidence-backed findings include `R-002` and `R-005`.

4. Open the evidence in the response. Explain that HandoffOS found the HR request but no laptop task, then traced the dependency to Identity Access and VPN Setup. The system is reporting deterministic evidence, not inventing an explanation.

5. Call `simulate_resolution`:

   ```json
   {
     "workflowId": "onboard-priya",
     "nodeId": "laptop-allocation",
     "resolvedAt": "2025-01-15T10:00:00.000Z"
   }
   ```

   Show the projected health change from `62` to `86`. Confirm that `workflow://onboard-priya/state` is unchanged: this is a simulation, not a write.

6. Call `plan_next_actions`:

   ```json
   { "workflowId": "onboard-priya" }
   ```

   Review the returned action `resolve-laptop-allocation`. Execution is only permitted for an action returned by this planning step.

7. Call `execute_action`:

   ```json
   {
     "workflowId": "onboard-priya",
     "actionId": "resolve-laptop-allocation",
     "approvedBy": "IT Director"
   }
   ```

   Show the live change: Laptop Allocation is complete, Identity Access and VPN Setup are ready, workflow health is `86`, and the audit entry names the approver.

8. Close with:

   > The dashboard is one MCP client. The reusable product is the workflow engine: evidence-backed state, deterministic simulation, approved action, and an auditable live update.

## Guardrails To Demonstrate

- Calling `execute_action` before `plan_next_actions` is rejected.
- Calling `execute_action` with a blank `approvedBy` is rejected.
- `simulate_resolution` never changes the live workflow state.
- Prompts direct the model to MCP evidence resources and prohibit invented facts.
