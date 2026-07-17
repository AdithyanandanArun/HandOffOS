import { ExecutionContext, Injectable, ToolDecorator as Tool, Widget } from '@nitrostack/core';
import { createDashboardData } from '../../application/handoffos.dashboard.js';
import { HandoffOSApplication } from '../../application/handoffos.application.js';
import {
  detectBlockersOutputSchema,
  executeActionSchema,
  executeActionOutputSchema,
  ingestEventSchema,
  ingestEventOutputSchema,
  planNextActionsOutputSchema,
  simulateResolutionSchema,
  simulateResolutionOutputSchema,
  workflowIdSchema,
  type ExecuteActionInput,
  type IngestEventInput,
  type SimulateResolutionInput,
  type WorkflowIdInput,
} from './handoffos.schemas.js';

@Injectable({ deps: [HandoffOSApplication] })
export class HandoffOSTools {
  constructor(private readonly application: HandoffOSApplication) {}

  @Tool({
    name: 'ingest_event',
    description: 'Ingest an enterprise event and recalculate the workflow state.',
    inputSchema: ingestEventSchema,
    outputSchema: ingestEventOutputSchema,
  })
  async ingestEvent(input: IngestEventInput, context: ExecutionContext) {
    context.logger.info('Ingesting workflow event', { workflowId: input.workflowId, eventId: input.event.id });
    const state = await this.application.ingestEvent(input.workflowId, input.event);
    return {
      summary: `Ingested ${input.event.type} from ${input.event.source}; workflow state was recalculated.`,
      state,
    };
  }

  @Widget({ route: 'handoff-dashboard', prefersBorder: false })
  @Tool({
    name: 'detect_blockers',
    description: 'Detect deterministic workflow blockers with evidence and risk breakdowns.',
    inputSchema: workflowIdSchema,
    outputSchema: detectBlockersOutputSchema,
  })
  async detectBlockers(input: WorkflowIdInput, context: ExecutionContext) {
    context.logger.info('Detecting workflow blockers', { workflowId: input.workflowId });
    const [analysis, state, auditLog] = await Promise.all([
      this.application.detectBlockers(input.workflowId),
      this.application.getState(input.workflowId),
      this.application.getAuditLog(input.workflowId),
    ]);
    return {
      summary: analysis.mainBlocker
        ? `${analysis.mainBlocker} is the root blocker; health is ${analysis.healthScore}/100.`
        : `No active root blocker was found; health is ${analysis.healthScore}/100.`,
      analysis,
      ...createDashboardData({ state, analysis, auditLog, liveTool: 'detect_blockers' }),
    };
  }

  @Widget({ route: 'handoff-dashboard', prefersBorder: false })
  @Tool({
    name: 'simulate_resolution',
    description: 'Simulate a workflow resolution without changing live workflow state.',
    inputSchema: simulateResolutionSchema,
    outputSchema: simulateResolutionOutputSchema,
  })
  async simulateResolution(input: SimulateResolutionInput, context: ExecutionContext) {
    context.logger.info('Simulating workflow resolution', { workflowId: input.workflowId, nodeId: input.nodeId });
    const [simulation, state, auditLog] = await Promise.all([
      this.application.simulateResolution(input.workflowId, input.nodeId, input.resolvedAt),
      this.application.getState(input.workflowId),
      this.application.getAuditLog(input.workflowId),
    ]);
    return {
      summary: `Simulation projects health changing from ${simulation.before.healthScore} to ${simulation.after.healthScore}; live state is unchanged.`,
      simulationResult: simulation,
      ...createDashboardData({
        state,
        analysis: simulation.before,
        simulation,
        auditLog,
        liveTool: 'simulate_resolution',
      }),
    };
  }

  @Tool({
    name: 'plan_next_actions',
    description: 'Plan evidence-backed actions that require approval before execution.',
    inputSchema: workflowIdSchema,
    outputSchema: planNextActionsOutputSchema,
  })
  async planNextActions(input: WorkflowIdInput, context: ExecutionContext) {
    context.logger.info('Planning next workflow actions', { workflowId: input.workflowId });
    const actions = await this.application.planNextActions(input.workflowId);
    return {
      summary: actions.length
        ? `${actions.length} evidence-backed action${actions.length === 1 ? '' : 's'} require approval before execution.`
        : 'No executable action is currently required.',
      actions,
    };
  }

  @Widget({ route: 'handoff-dashboard', prefersBorder: false })
  @Tool({
    name: 'execute_action',
    description: 'Execute an approved planned action and recalculate the live workflow.',
    inputSchema: executeActionSchema,
    outputSchema: executeActionOutputSchema,
  })
  async executeAction(input: ExecuteActionInput, context: ExecutionContext) {
    context.logger.info('Executing approved workflow action', { workflowId: input.workflowId, actionId: input.actionId });
    const execution = await this.application.executeAction(input.workflowId, input.actionId, input.approvedBy);
    const [analysis, auditLog] = await Promise.all([
      this.application.detectBlockers(input.workflowId),
      this.application.getAuditLog(input.workflowId),
    ]);
    return {
      summary: execution.summary,
      execution,
      ...createDashboardData({
        state: execution.state,
        analysis,
        auditLog,
        execution,
        liveTool: 'execute_action',
      }),
    };
  }
}
