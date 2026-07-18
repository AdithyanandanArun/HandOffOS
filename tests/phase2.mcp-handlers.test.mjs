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
const { HandoffOSResources } = await import('../dist/modules/handoffos/handoffos.resources.js');

const context = { logger: { info() {} } };

test('Phase 2 MCP tool handlers return their advanced structured payloads', async () => {
  const app = createHandoffOSApplication();
  const tools = new HandoffOSTools(app);

  const escalation = await tools.escalateBlocker({ workflowId: 'onboard-priya', principalId: 'ops-analyst' }, context);
  assert.equal(escalation.escalation.nodeId, 'laptop-allocation');
  assert.equal(escalation.liveTool, 'escalate_blocker');
  assert.equal(escalation.authorization.principalId, 'ops-analyst');
  assert.equal(escalation.authorization.capability, 'escalate_blocker');

  const forecast = await tools.predictCompletion({ workflowId: 'onboard-priya', principalId: 'ops-analyst' }, context);
  assert.equal(forecast.forecast.workflowId, 'onboard-priya');
  assert.equal(forecast.liveTool, 'predict_completion');

  const comparison = await tools.compareWorkflows({ principalId: 'ops-analyst' }, context);
  assert.equal(comparison.comparisons.length, 2);
  assert.equal(comparison.liveTool, 'compare_workflows');

  const multi = await tools.simulateMultiResolution({
    workflowId: 'onboard-priya',
    nodeIds: ['laptop-allocation', 'identity-access'],
    resolvedAt: '2025-01-10T12:00:00.000Z',
    principalId: 'ops-analyst',
  }, context);
  assert.deepEqual(multi.multiSimulation.resolvedNodeIds, ['laptop-allocation', 'identity-access']);
  assert.equal(multi.liveTool, 'what_if_multi');

  const workload = await tools.getOwnerWorkload({ ownerId: 'IT Ops', principalId: 'demo-viewer' }, context);
  assert.ok(workload.workload.openNodeIds.includes('laptop-allocation'));
  assert.equal(workload.liveTool, 'get_owner_workload');

  const subscription = await tools.subscribeAlerts({
    workflowId: 'onboard-priya',
    metric: 'health',
    comparator: 'lt',
    threshold: 70,
    subscriberId: 'manager-001',
    principalId: 'it-operator',
  }, context);
  assert.equal(subscription.subscription.id, 'SUB-001');

  const report = await tools.exportAuditReport({ workflowId: 'onboard-priya', principalId: 'risk-auditor' }, context);
  assert.match(report.report.markdown, /HandoffOS Audit Report/);

  const emptyIntegrity = await tools.verifyAuditIntegrity({ workflowId: 'onboard-priya', principalId: 'risk-auditor' }, context);
  assert.equal(emptyIntegrity.integrity.valid, true);

  const actions = await tools.planNextActions({ workflowId: 'onboard-priya', principalId: 'ops-analyst' }, context);
  await tools.executeAction({
    workflowId: 'onboard-priya',
    actionId: actions.actions[0].id,
    principalId: 'it-director',
  }, context);
  const rollback = await tools.rollbackAction({ workflowId: 'onboard-priya', principalId: 'it-director' }, context);
  assert.equal(rollback.rollback.state.nodes.find((node) => node.id === 'laptop-allocation')?.status, 'blocked');
  const integrity = await tools.verifyAuditIntegrity({ workflowId: 'onboard-priya', principalId: 'risk-auditor' }, context);
  assert.equal(integrity.integrity.checkedEntries, 2);
});

test('MCP handlers enforce principal capabilities and the admin reset boundary', async () => {
  const app = createHandoffOSApplication();
  const tools = new HandoffOSTools(app);
  const planned = await tools.planNextActions({ workflowId: 'onboard-priya', principalId: 'ops-analyst' }, context);

  await assert.rejects(
    () => tools.executeAction({ workflowId: 'onboard-priya', actionId: planned.actions[0].id, principalId: 'demo-viewer' }, context),
    /not authorized/i,
  );
  await assert.rejects(
    () => tools.resetDemo({ principalId: 'it-director' }, context),
    /not authorized/i,
  );
  const reset = await tools.resetDemo({ principalId: 'workflow-admin' }, context);
  assert.deepEqual(reset.reset.workflowIds, ['onboard-priya', 'vendor-onboarding']);
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

test('workflow catalog and vendor resources expose both deterministic workflows', async () => {
  const resources = new HandoffOSResources(createHandoffOSApplication());
  const catalog = await resources.getCatalog('workflow://catalog', context);
  const catalogData = JSON.parse(catalog.contents[0].text);
  assert.deepEqual(catalogData.map((workflow) => workflow.workflowId), ['onboard-priya', 'vendor-onboarding']);

  const vendorState = await resources.getVendorState('workflow://vendor-onboarding/state', context);
  assert.equal(JSON.parse(vendorState.contents[0].text).workflowId, 'vendor-onboarding');

  const integrity = await resources.getVendorAuditIntegrity('workflow://vendor-onboarding/audit-integrity', context);
  assert.equal(JSON.parse(integrity.contents[0].text).valid, true);
});
