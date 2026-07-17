import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HandoffOSApplication,
  IntegrationPendingError,
} from '../../dist/application/handoffos.application.js';
import {
  executeActionSchema,
  ingestEventSchema,
  simulateResolutionSchema,
} from '../../dist/modules/handoffos/handoffos.schemas.js';

const workflowId = 'onboard-priya';
const state = {
  workflowId,
  employee: 'Priya Nair',
  joiningDate: '2026-07-20T09:00:00.000Z',
  status: 'blocked',
  healthScore: 62,
  estimatedCompletion: '2026-07-21T17:00:00.000Z',
  nodes: [],
  updatedAt: '2026-07-17T09:00:00.000Z',
};

function createApplication() {
  const executedActions = [];
  const workflow = {
    getState: async () => state,
    getEvents: async () => [],
    ingestEvent: async () => state,
  };
  const analysis = {
    getFindings: async () => [],
    getRules: async () => [],
    detectBlockers: async () => ({
      workflowId,
      findings: [],
      evidence: [],
      healthScore: 62,
      healthBreakdown: [],
      criticalPath: [],
      estimatedCompletion: state.estimatedCompletion,
    }),
    simulateResolution: async () => ({ before: {}, after: {} }),
  };
  const actions = {
    planNextActions: async () => [{
      id: 'create-laptop-task',
      title: 'Create Laptop Task',
      owner: 'IT',
      evidenceIds: ['evidence-laptop-missing'],
      expectedImpact: 'Unblocks Identity Access',
      requiresApproval: true,
    }],
    executeAction: async (_workflowId, actionId, approvedBy) => {
      executedActions.push({ actionId, approvedBy });
      return {
        workflowId,
        actionId,
        approvedBy,
        summary: 'Laptop task created',
        state,
        auditEntry: {
          id: 'audit-1',
          timestamp: '2026-07-17T09:10:00.000Z',
          action: 'Laptop task created',
          actor: approvedBy,
          details: 'Created by approved action',
        },
      };
    },
  };
  const audit = { getAuditLog: async () => [] };

  return {
    application: new HandoffOSApplication(workflow, analysis, actions, audit),
    executedActions,
  };
}

test('execute_action rejects actions that were not planned', async () => {
  const { application } = createApplication();

  await assert.rejects(
    application.executeAction(workflowId, 'create-laptop-task', 'Priya Manager'),
    /plan_next_actions/,
  );
});

test('execute_action only executes a planned action with an approver', async () => {
  const { application, executedActions } = createApplication();

  await application.planNextActions(workflowId);
  const result = await application.executeAction(workflowId, 'create-laptop-task', 'Priya Manager');

  assert.equal(result.auditEntry.action, 'Laptop task created');
  assert.deepEqual(executedActions, [{ actionId: 'create-laptop-task', approvedBy: 'Priya Manager' }]);
  await assert.rejects(
    application.executeAction(workflowId, 'create-laptop-task', 'Priya Manager'),
    /plan_next_actions/,
  );
});

test('tool schemas require valid workflow inputs and an approver', () => {
  assert.equal(executeActionSchema.safeParse({ workflowId, actionId: 'create-laptop-task' }).success, false);
  assert.equal(simulateResolutionSchema.safeParse({ workflowId, nodeId: 'laptop-allocation' }).success, false);
  assert.equal(ingestEventSchema.safeParse({ workflowId, event: {} }).success, false);
});

test('the default application makes missing integrations explicit', async () => {
  const application = new HandoffOSApplication();
  assert.throws(() => application.getState(workflowId), IntegrationPendingError);
});
