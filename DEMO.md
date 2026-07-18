# HandoffOS Two-Minute Demo

## Setup

```bash
npm run build
```

Open `/home/adithyan/Documents/HandOffOS` in NitroStudio after the build completes. The in-memory Priya and Apex workflows reset whenever the server restarts. You can also call `reset_demo` as `workflow-admin` during a session.

Studio starts the static dashboard widget server on port `3001` and connects to the MCP server through stdio. Do not run `npm run dev` or rebuild the project while Studio is open, because either action changes project files and makes Studio reload.

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
   { "workflowId": "onboard-priya", "principalId": "demo-viewer" }
   ```

   Show that Laptop Allocation is the root blocker, health is `62`, and the evidence-backed findings include `R-002` and `R-005`.

4. Open the evidence in the response. Explain that HandoffOS found the HR request but no laptop task, then traced the dependency to Identity Access and VPN Setup. The system is reporting deterministic evidence, not inventing an explanation.

5. Call `simulate_resolution`:

   ```json
   {
     "workflowId": "onboard-priya",
     "principalId": "ops-analyst",
     "nodeId": "laptop-allocation",
     "resolvedAt": "2025-01-15T10:00:00.000Z"
   }
   ```

   Show the projected health change from `62` to `86`. Confirm that `workflow://onboard-priya/state` is unchanged: this is a simulation, not a write.

6. Call `plan_next_actions`:

   ```json
   { "workflowId": "onboard-priya", "principalId": "ops-analyst" }
   ```

   Review the returned action `resolve-laptop-allocation`. Execution is only permitted for an action returned by this planning step.

7. Call `execute_action`:

   ```json
   {
     "workflowId": "onboard-priya",
     "actionId": "resolve-laptop-allocation",
     "principalId": "it-director"
   }
   ```

   Show the live change: Laptop Allocation is complete, Identity Access and VPN Setup are ready, workflow health is `86`, and the audit entry names the authorized principal.

8. Verify the audit chain:

   ```json
   { "workflowId": "onboard-priya", "principalId": "risk-auditor" }
   ```

   Call `verify_audit_integrity` and show the valid SHA-256 chain. Then use `workflow://onboard-priya/audit-integrity` to show the same state as an MCP resource.

9. Close with:

   > The dashboard is one MCP client. The reusable product is the workflow engine: evidence-backed state, deterministic simulation, approved action, and an auditable live update.

## Guardrails To Demonstrate

- Calling `execute_action` before `plan_next_actions` is rejected.
- Calling `execute_action` with `demo-viewer` is rejected; only `it-director` has the required capability in this local demo policy.
- `simulate_resolution` never changes the live workflow state.
- Prompts direct the model to MCP evidence resources and prohibit invented facts.
- These local principals demonstrate a policy boundary only. Production deployment requires real authenticated identity and tenant isolation.
