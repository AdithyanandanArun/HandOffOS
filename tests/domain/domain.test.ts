/**
 * tests/domain/domain.test.ts
 *
 * G-owned domain unit tests covering:
 *   - Deterministic seeding (G.md acceptance criterion 1)
 *   - Dependency propagation (G.md acceptance criterion 4)
 *   - State cloning / immutability (G.md acceptance criterion 5)
 *   - Event and evidence ingestion (G.md task 5 + acceptance criteria)
 *   - Graph traversal helpers in src/workflow/graph.ts (G.md task 7)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createSeedState, createVendorOnboardingState } from '../../src/workflow/seed.js';
import { InMemoryWorkflowStateStore, InMemoryAlertSubscriptionStore } from '../../src/workflow/state-store.js';
import {
  areDependenciesComplete,
  getIncompleteDependencies,
  getDownstreamNodes,
  computeCriticalPath,
  findRootBlocker,
  deriveNodeStatus,
  propagateStatuses,
  getOwnerWorkload,
} from '../../src/workflow/graph.js';
import { SEED_EVENTS, SEED_EVIDENCE } from '../../src/domain/events.js';
import { demoNow, PRIYA_JOINING_DATE, LAPTOP_SLA_DEADLINE } from '../../src/domain/demo-clock.js';
import type { WorkflowState, SourceEvent, Evidence, AuditEntry, AlertSubscription } from '../../src/domain/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fresh(): WorkflowState {
  return createSeedState();
}

// ---------------------------------------------------------------------------
// 1. Deterministic seeding
// ---------------------------------------------------------------------------

describe('Deterministic Seeding', () => {
  it('creates a workflow with all 7 canonical node IDs', () => {
    const state = fresh();
    const ids = state.nodes.map(n => n.id);
    assert.ok(ids.includes('manager-approval'));
    assert.ok(ids.includes('hr-verification'));
    assert.ok(ids.includes('laptop-allocation'));
    assert.ok(ids.includes('identity-access'));
    assert.ok(ids.includes('vpn-setup'));
    assert.ok(ids.includes('developer-access'));
    assert.ok(ids.includes('orientation'));
    assert.equal(ids.length, 7);
  });

  it('sets manager-approval and hr-verification to completed', () => {
    const state = fresh();
    const managerNode = state.nodes.find(n => n.id === 'manager-approval')!;
    const hrNode = state.nodes.find(n => n.id === 'hr-verification')!;
    assert.equal(managerNode.status, 'completed');
    assert.equal(hrNode.status, 'completed');
  });

  it('sets laptop-allocation to blocked', () => {
    const state = fresh();
    const node = state.nodes.find(n => n.id === 'laptop-allocation')!;
    assert.equal(node.status, 'blocked');
  });

  it('sets identity-access and vpn-setup to blocked', () => {
    const state = fresh();
    const ia = state.nodes.find(n => n.id === 'identity-access')!;
    const vpn = state.nodes.find(n => n.id === 'vpn-setup')!;
    assert.equal(ia.status, 'blocked');
    assert.equal(vpn.status, 'blocked');
  });

  it('sets developer-access and orientation to pending', () => {
    const state = fresh();
    const dev = state.nodes.find(n => n.id === 'developer-access')!;
    const orient = state.nodes.find(n => n.id === 'orientation')!;
    assert.equal(dev.status, 'pending');
    assert.equal(orient.status, 'pending');
  });

  it('produces identical state across two fresh calls (determinism)', () => {
    const a = fresh();
    const b = fresh();
    assert.deepEqual(
      JSON.parse(JSON.stringify(a)),
      JSON.parse(JSON.stringify(b))
    );
  });

  it('seeds events from all four required sources', () => {
    const sources = new Set(SEED_EVENTS.map(e => e.source));
    assert.ok(sources.has('gmail'), 'missing gmail source');
    assert.ok(sources.has('hr-system'), 'missing hr-system source');
    assert.ok(sources.has('task-board'), 'missing task-board source');
    assert.ok(sources.has('calendar'), 'missing calendar source');
  });

  it('has at least one absence evidence for the missing laptop task', () => {
    const absences = SEED_EVIDENCE.filter(e => e.type === 'absence');
    const laptopAbsence = absences.find(e =>
      e.description.toLowerCase().includes('laptop') ||
      e.description.toLowerCase().includes('provisioning')
    );
    assert.ok(laptopAbsence, 'no absence evidence found for laptop task');
  });

  it('demo clock returns a fixed repeatable date', () => {
    const t1 = demoNow();
    const t2 = demoNow();
    assert.equal(t1.getTime(), t2.getTime());
  });

  it('PRIYA_JOINING_DATE is before demo clock now', () => {
    assert.ok(PRIYA_JOINING_DATE.getTime() < demoNow().getTime());
  });

  it('LAPTOP_SLA_DEADLINE is before demo clock now (overdue)', () => {
    assert.ok(LAPTOP_SLA_DEADLINE.getTime() < demoNow().getTime());
  });
});

// ---------------------------------------------------------------------------
// 2. Dependency propagation (graph helpers)
// ---------------------------------------------------------------------------

describe('Dependency Checks', () => {
  it('areDependenciesComplete: true for laptop-allocation (deps are completed)', () => {
    const state = fresh();
    assert.equal(areDependenciesComplete(state, 'laptop-allocation'), true);
  });

  it('areDependenciesComplete: false for identity-access (laptop not complete)', () => {
    const state = fresh();
    assert.equal(areDependenciesComplete(state, 'identity-access'), false);
  });

  it('areDependenciesComplete: true for manager-approval (no deps)', () => {
    const state = fresh();
    assert.equal(areDependenciesComplete(state, 'manager-approval'), true);
  });

  it('areDependenciesComplete: returns false for unknown node', () => {
    const state = fresh();
    assert.equal(areDependenciesComplete(state, 'nonexistent'), false);
  });

  it('getIncompleteDependencies: returns laptop-allocation for identity-access', () => {
    const state = fresh();
    const missing = getIncompleteDependencies(state, 'identity-access');
    assert.ok(missing.includes('laptop-allocation'));
  });

  it('getIncompleteDependencies: returns empty for manager-approval', () => {
    const state = fresh();
    const missing = getIncompleteDependencies(state, 'manager-approval');
    assert.equal(missing.length, 0);
  });
});

describe('Downstream Nodes (graph)', () => {
  it('laptop-allocation has 4 downstream nodes', () => {
    const state = fresh();
    const ds = getDownstreamNodes(state, 'laptop-allocation');
    assert.equal(ds.length, 4);
    assert.ok(ds.includes('identity-access'));
    assert.ok(ds.includes('vpn-setup'));
    assert.ok(ds.includes('developer-access'));
    assert.ok(ds.includes('orientation'));
  });

  it('orientation has no downstream nodes', () => {
    const state = fresh();
    const ds = getDownstreamNodes(state, 'orientation');
    assert.equal(ds.length, 0);
  });

  it('manager-approval has all other nodes downstream', () => {
    const state = fresh();
    const ds = getDownstreamNodes(state, 'manager-approval');
    assert.equal(ds.length, 6);
  });
});

describe('Critical Path (graph)', () => {
  it('starts at manager-approval', () => {
    const state = fresh();
    const cp = computeCriticalPath(state);
    assert.equal(cp[0], 'manager-approval');
  });

  it('ends at orientation', () => {
    const state = fresh();
    const cp = computeCriticalPath(state);
    assert.equal(cp[cp.length - 1], 'orientation');
  });

  it('has 6 nodes in the critical path (longest single chain)', () => {
    const state = fresh();
    const cp = computeCriticalPath(state);
    assert.equal(cp.length, 6);
  });

  it('contains laptop-allocation', () => {
    const state = fresh();
    const cp = computeCriticalPath(state);
    assert.ok(cp.includes('laptop-allocation'));
  });
});

describe('Root Blocker (graph)', () => {
  it('identifies laptop-allocation as root blocker in seed state', () => {
    const state = fresh();
    assert.equal(findRootBlocker(state), 'laptop-allocation');
  });

  it('returns null when no nodes are blocked', () => {
    const state = fresh();
    for (const node of state.nodes) node.status = 'completed';
    assert.equal(findRootBlocker(state), null);
  });
});

describe('deriveNodeStatus', () => {
  it('keeps completed nodes completed', () => {
    const state = fresh();
    assert.equal(deriveNodeStatus(state, 'manager-approval'), 'completed');
  });

  it('marks identity-access as blocked (blocked dep)', () => {
    const state = fresh();
    assert.equal(deriveNodeStatus(state, 'identity-access'), 'blocked');
  });

  it('marks laptop-allocation as ready after all its deps complete', () => {
    const state = fresh();
    // laptop-allocation depends on hr-verification which is completed;
    // however laptop-allocation is explicitly marked blocked.
    // deriveNodeStatus ignores the stored status and re-derives.
    assert.equal(deriveNodeStatus(state, 'laptop-allocation'), 'ready');
  });
});

describe('propagateStatuses', () => {
  it('unblocks identity-access when laptop-allocation is completed', () => {
    const state = fresh();
    const laptop = state.nodes.find(n => n.id === 'laptop-allocation')!;
    laptop.status = 'completed';
    const updated = propagateStatuses(state);
    const ia = updated.nodes.find(n => n.id === 'identity-access')!;
    const vpn = updated.nodes.find(n => n.id === 'vpn-setup')!;
    assert.equal(ia.status, 'ready');
    assert.equal(vpn.status, 'ready');
  });

  it('does not mutate the original state', () => {
    const state = fresh();
    const originalJson = JSON.stringify(state.nodes);
    const laptop = state.nodes.find(n => n.id === 'laptop-allocation')!;
    laptop.status = 'completed';
    propagateStatuses(state);
    // only laptop was mutated in original before the call; that is expected
    // but all OTHER nodes should be unchanged in the original
    const afterJson = JSON.stringify(state.nodes);
    // The original laptop is already mutated by the test, but propagateStatuses
    // itself should not mutate other nodes in the original array.
    const afterNodes = JSON.parse(afterJson) as Array<{ id: string; status: string }>;
    const afterIa = afterNodes.find(n => n.id === 'identity-access')!;
    // original should still be blocked (propagateStatuses returns new state)
    assert.equal(afterIa.status, 'blocked');
  });
});

// ---------------------------------------------------------------------------
// 3. State cloning / immutability (WorkflowStateStore)
// ---------------------------------------------------------------------------

describe('InMemoryWorkflowStateStore — Immutability', () => {
  it('getState returns a deep clone, not a reference', () => {
    const store = new InMemoryWorkflowStateStore();
    const seed = fresh();
    store.setState(seed);

    const snapshot1 = store.getState('onboard-priya')!;
    // Mutate the snapshot
    snapshot1.nodes[0].status = 'in_progress';

    const snapshot2 = store.getState('onboard-priya')!;
    // Stored state should be unaffected
    assert.notEqual(snapshot2.nodes[0].status, 'in_progress');
  });

  it('setState stores a clone — mutating the original does not affect stored state', () => {
    const store = new InMemoryWorkflowStateStore();
    const seed = fresh();
    store.setState(seed);

    // Mutate original after storing
    seed.nodes[0].status = 'in_progress';

    const stored = store.getState('onboard-priya')!;
    assert.notEqual(stored.nodes[0].status, 'in_progress');
  });

  it('getState returns null for unknown workflow IDs', () => {
    const store = new InMemoryWorkflowStateStore();
    assert.equal(store.getState('unknown-id'), null);
  });

  it('getNode returns a clone of a specific node', () => {
    const store = new InMemoryWorkflowStateStore();
    store.setState(fresh());
    const node = store.getNode('onboard-priya', 'laptop-allocation')!;
    node.status = 'completed'; // mutate the returned clone
    // store should still hold blocked status
    const node2 = store.getNode('onboard-priya', 'laptop-allocation')!;
    assert.equal(node2.status, 'blocked');
  });

  it('getNode returns null for unknown node ID', () => {
    const store = new InMemoryWorkflowStateStore();
    store.setState(fresh());
    assert.equal(store.getNode('onboard-priya', 'nonexistent'), null);
  });
});

// ---------------------------------------------------------------------------
// 4. Event and evidence ingestion
// ---------------------------------------------------------------------------

describe('Event Ingestion', () => {
  it('addEvent appends to the stored state events list', () => {
    const store = new InMemoryWorkflowStateStore();
    store.setState(fresh());

    const newEvent: SourceEvent = {
      id: 'EVT-TEST',
      source: 'task-board',
      timestamp: demoNow(),
      actor: 'Test Actor',
      type: 'task_created',
      payload: { title: 'Laptop provisioning task' },
      evidenceId: 'EVD-TEST',
    };

    store.addEvent('onboard-priya', newEvent);
    const state = store.getState('onboard-priya')!;
    const found = state.events.find(e => e.id === 'EVT-TEST');
    assert.ok(found, 'event was not stored');
    assert.equal(found!.actor, 'Test Actor');
  });

  it('addEvidence appends evidence to the stored state', () => {
    const store = new InMemoryWorkflowStateStore();
    store.setState(fresh());

    const newEv: Evidence = {
      id: 'EVD-TEST',
      sourceEventId: 'EVT-TEST',
      type: 'event',
      description: 'Test evidence',
      timestamp: demoNow(),
    };

    store.addEvidence('onboard-priya', newEv);
    const state = store.getState('onboard-priya')!;
    assert.ok(state.evidence.find(e => e.id === 'EVD-TEST'));
  });

  it('addAuditEntry appends to audit log', () => {
    const store = new InMemoryWorkflowStateStore();
    store.setState(fresh());

    const entry: AuditEntry = {
      id: 'AUD-001',
      timestamp: demoNow(),
      action: 'execute_action',
      actor: 'test-user',
      details: { nodeId: 'laptop-allocation' },
    };

    store.addAuditEntry('onboard-priya', entry);
    const state = store.getState('onboard-priya')!;
    assert.ok(state.auditLog.find(a => a.id === 'AUD-001'));
  });

  it('updateNode mutates the node in the stored state', () => {
    const store = new InMemoryWorkflowStateStore();
    store.setState(fresh());

    store.updateNode('onboard-priya', 'laptop-allocation', { status: 'completed' });
    const node = store.getNode('onboard-priya', 'laptop-allocation')!;
    assert.equal(node.status, 'completed');
  });

  it('seed state contains events from all four required sources', () => {
    const state = fresh();
    const sources = new Set(state.events.map(e => e.source));
    assert.ok(sources.has('gmail'));
    assert.ok(sources.has('hr-system'));
    assert.ok(sources.has('task-board'));
    assert.ok(sources.has('calendar'));
  });
});

describe('Phase 2 G-domain Features', () => {
  it('seeds vendor-onboarding workflow with correct details', () => {
    const state = createVendorOnboardingState();
    assert.equal(state.workflowId, 'vendor-onboarding');
    assert.equal(state.subject, 'Acme Analytics');
    assert.ok(state.nodes.some(n => n.id === 'security-review'));
  });

  it('listWorkflowIds and getStates support multi-workflow tracking', () => {
    const store = new InMemoryWorkflowStateStore();
    store.setState(fresh());
    store.setState(createVendorOnboardingState());

    const ids = store.listWorkflowIds();
    assert.ok(ids.includes('onboard-priya'));
    assert.ok(ids.includes('vendor-onboarding'));

    const states = store.getStates(['onboard-priya', 'vendor-onboarding']);
    assert.equal(states.length, 2);
    assert.ok(states.some(s => s.workflowId === 'onboard-priya'));
    assert.ok(states.some(s => s.workflowId === 'vendor-onboarding'));
  });

  it('tracks rollback state history when the runtime records a pre-action snapshot', () => {
    const store = new InMemoryWorkflowStateStore();
    const state1 = fresh();
    store.setState(state1);

    store.recordHistory('onboard-priya', state1);

    // Modify state and add the action audit entry.
    const state2 = JSON.parse(JSON.stringify(state1)) as WorkflowState;
    state2.nodes[0].status = 'in_progress';
    state2.auditLog.push({
      id: 'AUD-999',
      timestamp: demoNow(),
      action: 'execute_action',
      actor: 'approver',
      details: { summary: 'State changed' },
    });

    store.setState(state2);

    const prev = store.getPreviousState('onboard-priya');
    assert.ok(prev);
    assert.equal(prev!.nodes[0].status, 'completed');

    const prev2 = store.getPreviousState('onboard-priya');
    assert.equal(prev2!.nodes[0].status, 'completed');

    const restored = store.restorePreviousState('onboard-priya');
    assert.equal(restored!.nodes[0].status, 'completed');
    assert.equal(store.getPreviousState('onboard-priya'), null);
  });

  it('does not infer rollback history from audit text', () => {
    const store = new InMemoryWorkflowStateStore();
    const state1 = fresh();
    store.setState(state1);

    const state2 = JSON.parse(JSON.stringify(state1)) as WorkflowState;
    state2.auditLog.push({
      id: 'AUD-999',
      timestamp: demoNow(),
      action: 'Enterprise event ingested',
      actor: 'system',
      details: { summary: 'Event ingested' },
    });

    store.setState(state2);

    assert.equal(store.getPreviousState('onboard-priya'), null);
  });

  it('aggregates workload across multiple workflows correctly', () => {
    const store = new InMemoryWorkflowStateStore();
    const priya = fresh();
    const vendor = createVendorOnboardingState();
    
    priya.nodes.find(n => n.id === 'laptop-allocation')!.owner = 'IT Ops';
    priya.nodes.find(n => n.id === 'orientation')!.owner = 'IT Ops';
    
    vendor.nodes.find(n => n.id === 'security-review')!.owner = 'IT Ops';
    vendor.nodes.find(n => n.id === 'vendor-activation')!.owner = 'IT Ops';

    priya.findings = [
      {
        id: 'FND-1',
        ruleId: 'R-001',
        title: 'Blocker finding',
        severity: 'high',
        explanation: 'Blocker',
        evidenceIds: [],
        affectedNodeIds: ['laptop-allocation'],
        riskPoints: 10,
      }
    ];

    vendor.findings = [
      {
        id: 'FND-2',
        ruleId: 'R-001',
        title: 'Vendor blocker',
        severity: 'high',
        explanation: 'Vendor blocker',
        evidenceIds: [],
        affectedNodeIds: ['security-review'],
        riskPoints: 10,
      }
    ];

    store.setState(priya);
    store.setState(vendor);

    const workload = getOwnerWorkload(store, 'IT Ops');
    assert.equal(workload.openNodesCount, 4);
    assert.equal(workload.findingsCount, 2);
  });

  it('supports AlertSubscriptionStore operations', () => {
    const store = new InMemoryAlertSubscriptionStore();
    const sub: AlertSubscription = {
      id: 'sub-1',
      workflowId: 'onboard-priya',
      metric: 'health',
      threshold: 90,
      comparator: 'lt',
      subscriberId: 'user-1',
      createdAt: demoNow(),
    };

    store.addSubscription(sub);
    const subs = store.listSubscriptions();
    assert.equal(subs.length, 1);
    assert.equal(subs[0].id, 'sub-1');

    store.removeSubscription('sub-1');
    assert.equal(store.listSubscriptions().length, 0);
  });
});
