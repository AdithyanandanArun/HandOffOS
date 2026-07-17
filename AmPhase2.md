# Am: Rules, Evidence, Health, and Simulation Owner — Phase 2 Focus: Advanced Rules, SLA Forecasting, and Multi-Simulation

You are Am, the deterministic analysis owner for HandoffOS. Read `README.md`, `Plan.md`, `implementation.md`, and `Done.md` before changing code.

## Mission

Implement the new rules (`R-008`, `R-009`, `R-010`), calibrate their risk points in `RISK_POINTS`, add finding confidence classification, and implement advanced analytics for SLA forecasting and multi-node resolution simulation. This layer remains strictly deterministic and framework-independent.

## Ownership

You own:

- `src/rules/**`
- `src/analysis/**`
- Rule and simulation tests under `tests/rules/**`

Do not edit `src/domain/**`, `src/workflow/**`, `src/modules/handoffos/**`, or `src/widgets/**`. Consume G's public domain interfaces and expose stable analysis interfaces for Ad.

## Implementation Tasks

1. **Implement New Rules**:
   - `R-008` Duplicate Task Detected (risk: 5 points): Fires when two independent source events attempt to create/register the same logical task node.
   - `R-009` Owner Unresponsive (risk: 8 points): Fires when no activity or update event from an assigned owner occurs within a configured SLA window.
   - `R-010` Conflicting Status (risk: 10 points): Fires when two source systems report different statuses for the same task node.

2. **Calibrate Risk Policy**:
   Update the exported `RISK_POINTS` configuration and the workflow health formula documentation to include the new rules, ensuring they do not double-count downstream impact already represented by existing findings.

3. **Add Finding Confidence Classification**:
   Add a `confidence` field (with values `"strong"` or `"weak"`) to every generated `Finding`:
   - `"strong"`: The finding has 2 or more corroborating evidence entries.
   - `"weak"`: The finding is based on an absence check (e.g., missing documents) or has a single evidence entry.

4. **Implement SLA Forecasting**:
   Implement `predictCompletion(state)` to calculate a deterministic forecast of the completion date using SLA windows and dependency depth, with a breakdown of which nodes are driving the delay. This must not use machine learning or randomness.

5. **Implement Multi-Node Simulation**:
   Implement `simulateMultiResolution(state, nodeIds[], resolvedAt)` using a deep clone. It must resolve multiple nodes at once in one cloned-state pass, returning combined before/after health, estimated completion, new critical path, and findings delta without mutating live state.

## Invariants

- Rules never call an LLM.
- Rules never invent events, owners, dates, or task statuses.
- Simulation never writes to the live store.
- Finding IDs and rule IDs are stable for the same input state.
- Completion forecasting is 100% deterministic (no ML, no randomness).
- Health output includes enough breakdown data to explain the score.

## Acceptance Criteria

- New rules `R-008`, `R-009`, and `R-010` fire correctly on the seeded events.
- Every finding is decorated with the correct `confidence` level.
- `predictCompletion` correctly computes completion dates and lists delay-driving nodes.
- `simulateMultiResolution` resolves multiple nodes in a cloned state, leaving the live store intact, and accurately reports findings changes.
- Automated tests in `tests/rules/**` cover each new rule, confidence rating, and the forecasting/multi-simulation logic.

## Completion Protocol

After each verified task, append one concise entry to `Done.md` with date, owner, phase, files, verification, and commit hash if committed. Preserve existing entries; never rewrite the tracker. Do not add a `Co-authored-by` trailer.
