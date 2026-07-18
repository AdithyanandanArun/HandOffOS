import assert from 'node:assert/strict';
import test from 'node:test';

import { createSeedStates } from '../dist/workflow/seed.js';
import { AlertSubscriptionStore } from '../dist/workflow/alerts.js';
import { InMemoryWorkflowStateStore } from '../dist/workflow/state-store.js';
import { getOwnerWorkload } from '../dist/workflow/workload.js';
import { appendAuditEntry, verifyAuditIntegrity } from '../dist/workflow/audit.js';

test('seeds independent onboarding and vendor workflows with deterministic rule evidence', () => {
  const states = createSeedStates();
  assert.deepEqual(states.map((state) => state.workflowId), ['onboard-priya', 'vendor-onboarding']);

  const vendor = states.find((state) => state.workflowId === 'vendor-onboarding');
  assert.ok(vendor);
  assert.equal(vendor.events.filter((event) => event.logicalTaskKey === 'vendor-acme-security-review').length, 4);
  assert.deepEqual(
    vendor.events.filter((event) => event.reportedStatus).map((event) => event.reportedStatus),
    ['in_progress', 'blocked'],
  );
});

test('store isolates snapshots and restores prior action snapshots', () => {
  const [priya] = createSeedStates();
  const store = new InMemoryWorkflowStateStore();
  store.setState(priya);
  store.recordHistory(priya.workflowId, priya);

  const changed = store.getState(priya.workflowId);
  changed.nodes.find((node) => node.id === 'laptop-allocation').status = 'completed';
  store.setState(changed);

  assert.equal(store.getPreviousState(priya.workflowId).nodes.find((node) => node.id === 'laptop-allocation').status, 'blocked');
  assert.equal(store.restorePreviousState(priya.workflowId).nodes.find((node) => node.id === 'laptop-allocation').status, 'blocked');
  assert.equal(store.getPreviousState(priya.workflowId), null);
});

test('owner workload and alert subscriptions remain isolated from workflow state', () => {
  const states = createSeedStates();
  states[0].findings = [{
    id: 'R-002::laptop-allocation', ruleId: 'R-002', title: 'Missing dependency', severity: 'critical',
    explanation: 'Missing laptop task.', evidenceIds: [], affectedNodeIds: ['laptop-allocation'], riskPoints: 10,
  }];
  const workload = getOwnerWorkload(states, 'IT Ops');
  assert.deepEqual(workload.openNodeIds, ['laptop-allocation']);
  assert.deepEqual(workload.activeFindingIds, ['R-002::laptop-allocation']);

  const subscriptions = new AlertSubscriptionStore();
  subscriptions.add({ id: 'SUB-001', workflowId: 'onboard-priya', metric: 'health', comparator: 'lt', threshold: 80, subscriberId: 'it-ops', createdAt: new Date('2025-01-15T10:00:00Z') });
  assert.equal(subscriptions.list('onboard-priya').length, 1);
  assert.equal(subscriptions.remove('SUB-001'), true);
  assert.equal(subscriptions.list().length, 0);
});

test('audit records form a tamper-evident chain', () => {
  const [priya] = createSeedStates();
  appendAuditEntry(priya, {
    id: 'AUD-001',
    timestamp: new Date('2025-01-10T09:00:00Z'),
    action: 'First action',
    actor: 'it-director',
    details: { summary: 'First controlled change.' },
  });
  appendAuditEntry(priya, {
    id: 'AUD-002',
    timestamp: new Date('2025-01-10T10:00:00Z'),
    action: 'Second action',
    actor: 'it-director',
    details: { summary: 'Second controlled change.' },
  });

  assert.equal(verifyAuditIntegrity(priya.auditLog).valid, true);
  priya.auditLog[0].details.summary = 'Modified after the fact.';
  const tampered = verifyAuditIntegrity(priya.auditLog);
  assert.equal(tampered.valid, false);
  assert.equal(tampered.firstInvalidEntryId, 'AUD-001');
  assert.equal(tampered.reason, 'entry_hash_mismatch');
});
