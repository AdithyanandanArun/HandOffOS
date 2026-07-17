# G: Workflow Domain and State Owner — Phase 2 Focus: Multi-Workflow Generalization and State Auditing

You are G, the workflow domain owner for HandoffOS. Read `README.md`, `Plan.md`, `implementation.md`, and `Done.md` before changing code.

## Mission

Extend the framework-independent workflow domain layer to support multiple concurrently managed workflows, seed status-conflict and duplicate task events, expose owner workload aggregates, maintain alert subscriptions, and support step-rollback history. This layer remains strictly framework-free (no NitroStack, React, or AI SDKs).

## Ownership

You own:

- `src/domain/**`
- `src/workflow/**`
- Domain unit tests colocated with those modules or under `tests/domain/**`

Do not edit `src/modules/handoffos/**`, `src/rules/**`, or `src/widgets/**` except to document a required public interface in `Done.md`.

## Implementation Tasks

1. **Seed a Second Workflow**: 
   Seed a second workflow in the store, representing **vendor-onboarding** (e.g., `vendor-onboarding`), with its own nodes, dependencies, SLA parameters, and a deterministic root blocker, proving that the engine generalizes beyond Priya.
   
2. **Seed Rule-Triggering Events**:
   Seed conflicting-status event pairs (reporting opposing statuses from two different systems for the same task node) and duplicate-task event pairs (reporting two independent source events creating the same logical task) so that Am's new `R-008` (Duplicate Task) and `R-010` (Conflicting Status) rules can fire against real event evidence.

3. **Implement Workload Aggregation**:
   Create a `getOwnerWorkload(store, ownerId)` helper to aggregate the number of open nodes and active findings assigned to a specific owner across one or more active workflows.

4. **Add Rollback History Support**:
   Track state change history for each workflow. Implement `getPreviousState(workflowId)` to retrieve the prior state snapshot so that the `rollback_action` tool can restore it.

5. **Create Alert Subscription Store**:
   Design and implement an in-memory `AlertSubscriptionStore` (supporting adding, listing, and removing alert subscriptions) backing the `subscribe_alerts` tool.

6. **Expose Batch and ID Listing API**:
   Add `listWorkflowIds()` and a batched `getStates(workflowIds[])` method on the `WorkflowStateStore` so that the `compare_workflows` tool does not have to access private internals.

## Invariants

- A node cannot be `ready` while any dependency is incomplete.
- A blocked dependency propagates to downstream nodes.
- Event evidence must retain source, timestamp, actor, payload, and evidence ID.
- The seed states and event list must be deterministic across fresh process starts.
- State history is kept per `workflowId` and is updated only when a state-changing action (`execute_action` or `rollback_action`) is executed.
- Alert subscriptions are stored in-memory and are isolated from the workflow graph state itself.
- Domain code must not calculate AI explanations.

## Acceptance Criteria

- Both `onboard-priya` and the new `vendor-onboarding` workflow are discoverable and queryable in the store.
- Duplicate tasks and conflicting statuses are successfully seeded in the mock event list with proper IDs.
- `getOwnerWorkload` returns correct counts of open tasks and findings.
- `getPreviousState` returns the state snapshot from before the last mutation, or null if none exists.
- Alert subscription store supports adding, listing, and deleting records.
- Domain unit tests cover multi-workflow state, rollback tracking, and alert subscription storage.

## Completion Protocol

After each verified task, append one concise entry to `Done.md` with date, owner, phase, files, verification, and commit hash if committed. Preserve existing entries; never rewrite the tracker. Do not add a `Co-authored-by` trailer.
