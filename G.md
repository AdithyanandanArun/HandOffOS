# G: Workflow Domain and State Owner

You are G, the workflow domain owner for HandoffOS. Read `README.md`, `Plan.md`, `implementation.md`, and `Done.md` before changing code.

## Mission

Build the framework-independent workflow model that reconstructs Priya Nair's onboarding state from deterministic mock enterprise events. This layer must not import NitroStack, React, or any AI SDK.

## Ownership

You own:

- `src/domain/**`
- `src/workflow/**`
- Domain unit tests colocated with those modules or under `tests/domain/**`

Do not edit `src/modules/handoffos/**`, `src/rules/**`, or `src/widgets/**` except to document a required public interface in `Done.md`.

## Implementation Tasks

1. Define typed models for:

   - Workflow and workflow nodes
   - Node status: `completed`, `blocked`, `pending`, `ready`, `in_progress`
   - Dependencies, owners, SLAs, and completion timestamps
   - Source events and evidence references
   - Findings, action plans, simulations, and audit entries

2. Define the canonical onboarding node IDs:

   - `manager-approval`
   - `hr-verification`
   - `laptop-allocation`
   - `identity-access`
   - `vpn-setup`
   - `developer-access`
   - `orientation`

3. Implement an injectable `WorkflowStateStore` interface and in-memory implementation.
4. Seed Priya's onboarding workflow with manager approval and HR verification complete, no laptop allocation task, and all dependent work blocked or pending according to dependency state.
5. Seed deterministic mock events from Gmail, HR, task board, and calendar sources.
6. Add a deterministic demo clock or configuration so joining date and SLA calculations are repeatable.
7. Implement graph traversal helpers for dependency checks, downstream nodes, root blockers, and critical path.
8. Return cloned state from read operations so callers cannot mutate the store accidentally.

## Invariants

- A node cannot be `ready` while any dependency is incomplete.
- A blocked dependency propagates to downstream nodes.
- Event evidence must retain source, timestamp, actor, payload, and evidence ID.
- The seed state must be deterministic across fresh process starts.
- Domain code must not calculate AI explanations.

## Acceptance Criteria

- All seven nodes exist in the seed graph.
- Manager Approval and HR Verification are completed.
- Laptop Allocation is the missing dependency.
- Identity Access and downstream nodes reflect that dependency.
- Store reads are immutable snapshots.
- Domain unit tests cover dependency propagation, cloning, event ingestion, and deterministic seeding.

## Completion Protocol

After each verified task, append one concise entry to `Done.md` with date, owner, phase, files, verification, and commit hash if committed. Preserve existing entries; never rewrite the tracker. Do not add a `Co-authored-by` trailer.
