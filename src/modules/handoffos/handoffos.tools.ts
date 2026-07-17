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

const defaultWorkflowId = 'onboard-priya';

// NitroStudio task cards can omit fields with JSON Schema defaults.
function resolveWorkflowId(input: Partial<WorkflowIdInput> | undefined): string {
  return input?.workflowId || defaultWorkflowId;
}

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
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Ingesting workflow event', { workflowId, eventId: input.event.id });
    const state = await this.application.ingestEvent(workflowId, input.event);
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
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Detecting workflow blockers', { workflowId });
    const [analysis, state, auditLog] = await Promise.all([
      this.application.detectBlockers(workflowId),
      this.application.getState(workflowId),
      this.application.getAuditLog(workflowId),
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
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Simulating workflow resolution', { workflowId, nodeId: input.nodeId });
    const [simulation, state, auditLog] = await Promise.all([
      this.application.simulateResolution(workflowId, input.nodeId, input.resolvedAt),
      this.application.getState(workflowId),
      this.application.getAuditLog(workflowId),
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
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Planning next workflow actions', { workflowId });
    const actions = await this.application.planNextActions(workflowId);
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
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Executing approved workflow action', { workflowId, actionId: input.actionId });
    const execution = await this.application.executeAction(workflowId, input.actionId, input.approvedBy);
    const [analysis, auditLog] = await Promise.all([
      this.application.detectBlockers(workflowId),
      this.application.getAuditLog(workflowId),
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
