import assert from 'node:assert/strict';
import test from 'node:test';

// NitroStack starts a maintenance interval when decorators load. It is irrelevant
// to these in-memory tests, so do not let it keep the test worker alive.
const nativeSetInterval = globalThis.setInterval;
globalThis.setInterval = (...args) => {
  const timer = nativeSetInterval(...args);
  timer.unref?.();
  return timer;
};

const { createHandoffOSApplication } = await import('../dist/application/handoffos.application.js');

test('Phase 2 application returns deterministic operational query results', async () => {
  const app = createHandoffOSApplication();

  const comparisons = await app.compareWorkflows();
  assert.deepEqual(comparisons.map((workflow) => workflow.workflowId), [
    'onboard-priya',
    'vendor-onboarding',
  ]);

  const forecast = await app.predictCompletion('onboard-priya');
  assert.equal(forecast.workflowId, 'onboard-priya');
  assert.ok(forecast.criticalPath.includes('laptop-allocation'));

  const escalation = await app.escalateBlocker('onboard-priya');
  assert.equal(escalation.nodeId, 'laptop-allocation');
  assert.equal(escalation.owningTeam, 'IT Ops');
  assert.ok(escalation.findingIds.length > 0);

  const workload = await app.getOwnerWorkload('IT Ops');
  assert.ok(workload.openNodeIds.includes('laptop-allocation'));

  const subscription = await app.subscribeAlerts({
    workflowId: 'onboard-priya',
    metric: 'health',
    comparator: 'lt',
    threshold: 70,
    subscriberId: 'manager-001',
  });
  assert.equal(subscription.id, 'SUB-001');
  assert.equal(subscription.subscriberId, 'manager-001');

  const report = await app.exportAuditReport('vendor-onboarding');
  assert.equal(report.workflowId, 'vendor-onboarding');
  assert.match(report.markdown, /HandoffOS Audit Report/);
});

test('Phase 2 rollback is approval-gated and multi-simulation does not mutate live state', async () => {
  const app = createHandoffOSApplication();
  const plans = await app.planNextActions('onboard-priya');
  assert.equal(plans.length, 1);

  await assert.rejects(
    () => app.executeAction('onboard-priya', plans[0].id, ''),
    /approver/i,
  );

  await app.executeAction('onboard-priya', plans[0].id, 'IT Director');
  const executedState = await app.getState('onboard-priya');
  assert.equal(executedState.nodes.find((node) => node.id === 'laptop-allocation')?.status, 'completed');

  await assert.rejects(
    () => app.rollbackAction('onboard-priya', ''),
    /approver/i,
  );
  const rollback = await app.rollbackAction('onboard-priya', 'IT Director');
  assert.equal(rollback.state.nodes.find((node) => node.id === 'laptop-allocation')?.status, 'blocked');

  const simulation = await app.simulateMultiResolution(
    'onboard-priya',
    ['laptop-allocation', 'identity-access'],
    '2025-01-10T12:00:00.000Z',
  );
  assert.deepEqual(simulation.resolvedNodeIds, ['laptop-allocation', 'identity-access']);
  assert.ok(simulation.after.healthScore >= simulation.before.healthScore);

  const liveState = await app.getState('onboard-priya');
  assert.equal(liveState.nodes.find((node) => node.id === 'laptop-allocation')?.status, 'blocked');
});
