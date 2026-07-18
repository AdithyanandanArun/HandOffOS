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
const { HandoffOSPrompts } = await import('../dist/modules/handoffos/handoffos.prompts.js');
const { HandoffOSTools } = await import('../dist/modules/handoffos/handoffos.tools.js');

const context = { logger: { info() {} } };

test('Phase 2 MCP tool handlers return their advanced structured payloads', async () => {
  const app = createHandoffOSApplication();
  const tools = new HandoffOSTools(app);

  const escalation = await tools.escalateBlocker({ workflowId: 'onboard-priya' }, context);
  assert.equal(escalation.escalation.nodeId, 'laptop-allocation');
  assert.equal(escalation.liveTool, 'escalate_blocker');

  const forecast = await tools.predictCompletion({ workflowId: 'onboard-priya' }, context);
  assert.equal(forecast.forecast.workflowId, 'onboard-priya');
  assert.equal(forecast.liveTool, 'predict_completion');

  const comparison = await tools.compareWorkflows({}, context);
  assert.equal(comparison.comparisons.length, 2);
  assert.equal(comparison.liveTool, 'compare_workflows');

  const multi = await tools.simulateMultiResolution({
    workflowId: 'onboard-priya',
    nodeIds: ['laptop-allocation', 'identity-access'],
    resolvedAt: '2025-01-10T12:00:00.000Z',
  }, context);
  assert.deepEqual(multi.multiSimulation.resolvedNodeIds, ['laptop-allocation', 'identity-access']);
  assert.equal(multi.liveTool, 'what_if_multi');

  const workload = await tools.getOwnerWorkload({ ownerId: 'IT Ops' }, context);
  assert.ok(workload.workload.openNodeIds.includes('laptop-allocation'));
  assert.equal(workload.liveTool, 'get_owner_workload');

  const subscription = await tools.subscribeAlerts({
    workflowId: 'onboard-priya',
    metric: 'health',
    comparator: 'lt',
    threshold: 70,
    subscriberId: 'manager-001',
  }, context);
  assert.equal(subscription.subscription.id, 'SUB-001');

  const report = await tools.exportAuditReport({ workflowId: 'onboard-priya' }, context);
  assert.match(report.report.markdown, /HandoffOS Audit Report/);

  const actions = await tools.planNextActions({ workflowId: 'onboard-priya' }, context);
  await tools.executeAction({
    workflowId: 'onboard-priya',
    actionId: actions.actions[0].id,
    approvedBy: 'IT Director',
  }, context);
  const rollback = await tools.rollbackAction({ workflowId: 'onboard-priya', approvedBy: 'IT Director' }, context);
  assert.equal(rollback.rollback.state.nodes.find((node) => node.id === 'laptop-allocation')?.status, 'blocked');
});

test('Phase 2 MCP prompts require evidence-grounded responses', async () => {
  const prompts = new HandoffOSPrompts();

  const escalation = await prompts.escalationEmail({ workflowId: 'onboard-priya' }, context);
  assert.match(escalation[0].content, /escalate_blocker/);
  assert.match(escalation[0].content, /Do not claim an action was executed/);

  const digest = await prompts.executiveDigest({}, context);
  assert.match(digest[0].content, /compare_workflows/);
  assert.match(digest[0].content, /Do not infer/);

  const narrative = await prompts.rootCauseNarrative({ workflowId: 'vendor-onboarding' }, context);
  assert.match(narrative[0].content, /rule IDs/);

  const readiness = await prompts.onboardingReadinessCheck({}, context);
  assert.match(readiness[0].content, /not enough evidence/);
});
