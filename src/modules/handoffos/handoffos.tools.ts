import { ExecutionContext, ToolDecorator as Tool } from '@nitrostack/core';
import { handoffOSApplication } from '../../application/handoffos.application.js';
import {
  executeActionSchema,
  ingestEventSchema,
  simulateResolutionSchema,
  workflowIdSchema,
  type ExecuteActionInput,
  type IngestEventInput,
  type SimulateResolutionInput,
  type WorkflowIdInput,
} from './handoffos.schemas.js';

export class HandoffOSTools {
  @Tool({
    name: 'ingest_event',
    description: 'Ingest an enterprise event and recalculate the workflow state.',
    inputSchema: ingestEventSchema,
  })
  async ingestEvent(input: IngestEventInput, context: ExecutionContext) {
    context.logger.info('Ingesting workflow event', { workflowId: input.workflowId, eventId: input.event.id });
    return handoffOSApplication.ingestEvent(input.workflowId, input.event);
  }

  @Tool({
    name: 'detect_blockers',
    description: 'Detect deterministic workflow blockers with evidence and risk breakdowns.',
    inputSchema: workflowIdSchema,
  })
  async detectBlockers(input: WorkflowIdInput, context: ExecutionContext) {
    context.logger.info('Detecting workflow blockers', { workflowId: input.workflowId });
    return handoffOSApplication.detectBlockers(input.workflowId);
  }

  @Tool({
    name: 'simulate_resolution',
    description: 'Simulate a workflow resolution without changing live workflow state.',
    inputSchema: simulateResolutionSchema,
  })
  async simulateResolution(input: SimulateResolutionInput, context: ExecutionContext) {
    context.logger.info('Simulating workflow resolution', { workflowId: input.workflowId, nodeId: input.nodeId });
    return handoffOSApplication.simulateResolution(input.workflowId, input.nodeId, input.resolvedAt);
  }

  @Tool({
    name: 'plan_next_actions',
    description: 'Plan evidence-backed actions that require approval before execution.',
    inputSchema: workflowIdSchema,
  })
  async planNextActions(input: WorkflowIdInput, context: ExecutionContext) {
    context.logger.info('Planning next workflow actions', { workflowId: input.workflowId });
    return handoffOSApplication.planNextActions(input.workflowId);
  }

  @Tool({
    name: 'execute_action',
    description: 'Execute an approved planned action and recalculate the live workflow.',
    inputSchema: executeActionSchema,
  })
  async executeAction(input: ExecuteActionInput, context: ExecutionContext) {
    context.logger.info('Executing approved workflow action', { workflowId: input.workflowId, actionId: input.actionId });
    return handoffOSApplication.executeAction(input.workflowId, input.actionId, input.approvedBy);
  }
}
