import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractPrompts,
  extractResources,
  extractTools,
} from '@nitrostack/core';
import { createHandoffOSApplication } from '../../dist/application/handoffos.application.js';
import { HandoffOSPrompts } from '../../dist/modules/handoffos/handoffos.prompts.js';
import { HandoffOSResources } from '../../dist/modules/handoffos/handoffos.resources.js';
import {
  HandoffOSTools,
} from '../../dist/modules/handoffos/handoffos.tools.js';
import {
  executeActionSchema,
  executeActionOutputSchema,
  detectBlockersOutputSchema,
  ingestEventSchema,
  planNextActionsOutputSchema,
  simulateResolutionSchema,
  simulateResolutionOutputSchema,
} from '../../dist/modules/handoffos/handoffos.schemas.js';

const workflowId = 'onboard-priya';

function createApplication() {
  return createHandoffOSApplication();
}

const context = { logger: { info() {} } };

test('MCP discovery exposes the required HandoffOS resources, tools, and prompts', () => {
  assert.deepEqual(
    extractResources(HandoffOSResources).map((resource) => resource.options.uri),
    [
      'workflow://onboard-priya/state',
      'workflow://onboard-priya/events',
      'workflow://onboard-priya/findings',
      'workflow://onboard-priya/audit-log',
      'workflow://rules',
    ],
  );
  assert.deepEqual(
    extractTools(HandoffOSTools).map((tool) => tool.options.name),
    ['ingest_event', 'detect_blockers', 'simulate_resolution', 'plan_next_actions', 'execute_action'],
  );
  assert.deepEqual(
    extractPrompts(HandoffOSPrompts).map((prompt) => prompt.options.name),
    ['explain_blocker', 'manager_summary'],
  );
});

test('the fresh seed detects Laptop Allocation with rule IDs and evidence', async () => {
  const application = createApplication();
  const [state, analysis] = await Promise.all([
    application.getState(workflowId),
    application.detectBlockers(workflowId),
  ]);

  assert.equal(state.mainBlocker, 'laptop-allocation');
  assert.equal(state.healthScore, 62);
  assert.equal(analysis.mainBlocker, 'laptop-allocation');
  assert.ok(analysis.findings.some((finding) => finding.ruleId === 'R-002'));
  assert.ok(analysis.findings.some((finding) => finding.ruleId === 'R-005'));
  assert.ok(analysis.evidence.some((evidence) => evidence.id === 'EVD-004'));
});

test('tool schemas reject malformed event, simulation, and execution input', () => {
  assert.equal(executeActionSchema.safeParse({ workflowId, actionId: 'resolve-laptop-allocation' }).success, false);
  assert.equal(simulateResolutionSchema.safeParse({ workflowId, nodeId: 'laptop-allocation' }).success, false);
  assert.equal(ingestEventSchema.safeParse({ workflowId, event: {} }).success, false);
});

test('simulation improves the projection without mutating the live workflow', async () => {
  const application = createApplication();
  const before = await application.getState(workflowId);
  const simulation = await application.simulateResolution(
    workflowId,
    'laptop-allocation',
    '2025-01-15T10:00:00.000Z',
  );
  const after = await application.getState(workflowId);

  assert.equal(simulation.before.healthScore, 62);
  assert.equal(simulation.after.healthScore, 86);
  assert.ok(simulation.resolvedFindingIds.includes('R-002::laptop-allocation'));
  assert.deepEqual(after, before);
});

test('execute_action rejects unplanned and unapproved actions', async () => {
  const application = createApplication();

  await assert.rejects(
    application.executeAction(workflowId, 'resolve-laptop-allocation', 'IT Director'),
    /plan_next_actions/,
  );
  await application.planNextActions(workflowId);
  await assert.rejects(
    application.executeAction(workflowId, 'resolve-laptop-allocation', '  '),
    /approver is required/,
  );
});

test('approved laptop execution updates state, releases dependencies, and appends audit history', async () => {
  const application = createApplication();
  const actions = await application.planNextActions(workflowId);
  assert.deepEqual(actions.map((action) => action.id), ['resolve-laptop-allocation']);

  const result = await application.executeAction(workflowId, actions[0].id, 'IT Director');
  const auditLog = await application.getAuditLog(workflowId);

  assert.equal(result.state.nodes.find((node) => node.id === 'laptop-allocation')?.status, 'completed');
  assert.equal(result.state.nodes.find((node) => node.id === 'identity-access')?.status, 'ready');
  assert.equal(result.state.nodes.find((node) => node.id === 'vpn-setup')?.status, 'ready');
  assert.equal(result.state.healthScore, 86);
  assert.equal(auditLog.length, 1);
  assert.equal(auditLog[0].actor, 'IT Director');
  assert.match(auditLog[0].details, /recalculated workflow health/);
});

test('dashboard-linked tools emit validated structured responses for the widget', async () => {
  const application = createApplication();
  const tools = new HandoffOSTools(application);

  const blockers = await tools.detectBlockers({ workflowId }, context);
  assert.equal(detectBlockersOutputSchema.safeParse(blockers).success, true);
  assert.equal(blockers.workflow.stations.find((station) => station.id === 'laptop-allocation')?.status, 'blocked');

  const simulation = await tools.simulateResolution({
    workflowId,
    nodeId: 'laptop-allocation',
    resolvedAt: '2025-01-15T10:00:00.000Z',
  }, context);
  assert.equal(simulateResolutionOutputSchema.safeParse(simulation).success, true);
  assert.equal(simulation.simulation.after.health, 86);

  const plan = await tools.planNextActions({ workflowId }, context);
  assert.equal(planNextActionsOutputSchema.safeParse(plan).success, true);

  const execution = await tools.executeAction({
    workflowId,
    actionId: plan.actions[0].id,
    approvedBy: 'IT Director',
  }, context);
  assert.equal(executeActionOutputSchema.safeParse(execution).success, true);
  assert.equal(execution.workflow.stations.find((station) => station.id === 'identity-access')?.status, 'ready');
});
