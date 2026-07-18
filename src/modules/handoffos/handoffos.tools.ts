import { ExecutionContext, Injectable, ToolDecorator as Tool, Widget } from '@nitrostack/core';
import { createDashboardData } from '../../application/handoffos.dashboard.js';
import { HandoffOSApplication } from '../../application/handoffos.application.js';
import {
  compareWorkflowsOutputSchema,
  compareWorkflowsSchema,
  detectBlockersOutputSchema,
  escalateBlockerOutputSchema,
  escalateBlockerSchema,
  executeActionSchema,
  executeActionOutputSchema,
  exportAuditReportOutputSchema,
  exportAuditReportSchema,
  getOwnerWorkloadOutputSchema,
  getOwnerWorkloadSchema,
  ingestEventSchema,
  ingestEventOutputSchema,
  planNextActionsOutputSchema,
  predictCompletionOutputSchema,
  predictCompletionSchema,
  rollbackActionOutputSchema,
  rollbackActionSchema,
  simulateResolutionSchema,
  simulateResolutionOutputSchema,
  simulateMultiResolutionOutputSchema,
  simulateMultiResolutionSchema,
  subscribeAlertsOutputSchema,
  subscribeAlertsSchema,
  verifyAuditIntegrityOutputSchema,
  verifyAuditIntegritySchema,
  workflowIdSchema,
  type CompareWorkflowsInput,
  type EscalateBlockerInput,
  type ExecuteActionInput,
  type ExportAuditReportInput,
  type GetOwnerWorkloadInput,
  type IngestEventInput,
  type PredictCompletionInput,
  type RollbackActionInput,
  type SimulateResolutionInput,
  type SimulateMultiResolutionInput,
  type SubscribeAlertsInput,
  type VerifyAuditIntegrityInput,
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

  @Widget({ route: 'handoff-dashboard', prefersBorder: false })
  @Tool({
    name: 'escalate_blocker',
    description: 'Prepare an evidence-backed escalation for the workflow root blocker.',
    inputSchema: escalateBlockerSchema,
    outputSchema: escalateBlockerOutputSchema,
  })
  async escalateBlocker(input: EscalateBlockerInput, context: ExecutionContext) {
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Preparing blocker escalation', { workflowId });
    const [escalation, state, analysis, auditLog] = await Promise.all([
      this.application.escalateBlocker(workflowId),
      this.application.getState(workflowId),
      this.application.detectBlockers(workflowId),
      this.application.getAuditLog(workflowId),
    ]);
    return {
      summary: escalation.summary,
      escalation,
      ...createDashboardData({ state, analysis, auditLog, liveTool: 'escalate_blocker' }),
    };
  }

  @Widget({ route: 'handoff-dashboard', prefersBorder: false })
  @Tool({
    name: 'predict_completion',
    description: 'Forecast deterministic completion timing and identify critical-path delay drivers.',
    inputSchema: predictCompletionSchema,
    outputSchema: predictCompletionOutputSchema,
  })
  async predictCompletion(input: PredictCompletionInput, context: ExecutionContext) {
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Forecasting workflow completion', { workflowId });
    const [forecast, state, analysis, auditLog] = await Promise.all([
      this.application.predictCompletion(workflowId),
      this.application.getState(workflowId),
      this.application.detectBlockers(workflowId),
      this.application.getAuditLog(workflowId),
    ]);
    return {
      summary: `Estimated completion is ${forecast.estimatedCompletion}; ${forecast.delayDrivers.length} delay driver${forecast.delayDrivers.length === 1 ? '' : 's'} identified.`,
      forecast,
      ...createDashboardData({ state, analysis, auditLog, liveTool: 'predict_completion' }),
    };
  }

  @Widget({ route: 'handoff-dashboard', prefersBorder: false })
  @Tool({
    name: 'compare_workflows',
    description: 'Compare health, root blockers, and completion forecasts across active workflows.',
    inputSchema: compareWorkflowsSchema,
    outputSchema: compareWorkflowsOutputSchema,
  })
  async compareWorkflows(input: CompareWorkflowsInput, context: ExecutionContext) {
    context.logger.info('Comparing workflows', { workflowIds: input.workflowIds });
    const comparisons = await this.application.compareWorkflows(input.workflowIds);
    const dashboardWorkflowId = comparisons[0]?.workflowId ?? defaultWorkflowId;
    const [state, analysis, auditLog] = await Promise.all([
      this.application.getState(dashboardWorkflowId),
      this.application.detectBlockers(dashboardWorkflowId),
      this.application.getAuditLog(dashboardWorkflowId),
    ]);
    return {
      summary: `Compared ${comparisons.length} active workflow${comparisons.length === 1 ? '' : 's'} using deterministic health and forecast data.`,
      comparisons,
      ...createDashboardData({ state, analysis, auditLog, liveTool: 'compare_workflows' }),
    };
  }

  @Widget({ route: 'handoff-dashboard', prefersBorder: false })
  @Tool({
    name: 'rollback_action',
    description: 'Restore the snapshot before the last approved state-changing action.',
    inputSchema: rollbackActionSchema,
    outputSchema: rollbackActionOutputSchema,
  })
  async rollbackAction(input: RollbackActionInput, context: ExecutionContext) {
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Rolling back approved workflow action', { workflowId, approvedBy: input.approvedBy });
    const rollback = await this.application.rollbackAction(workflowId, input.approvedBy);
    const [analysis, auditLog] = await Promise.all([
      this.application.detectBlockers(workflowId),
      this.application.getAuditLog(workflowId),
    ]);
    return {
      summary: rollback.summary,
      rollback,
      ...createDashboardData({
        state: rollback.state,
        analysis,
        auditLog,
        liveTool: 'rollback_action',
      }),
    };
  }

  @Widget({ route: 'handoff-dashboard', prefersBorder: false })
  @Tool({
    name: 'what_if_multi',
    description: 'Simulate resolving multiple workflow nodes without changing the live workflow.',
    inputSchema: simulateMultiResolutionSchema,
    outputSchema: simulateMultiResolutionOutputSchema,
  })
  async simulateMultiResolution(input: SimulateMultiResolutionInput, context: ExecutionContext) {
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Simulating multiple workflow resolutions', { workflowId, nodeIds: input.nodeIds });
    const [multiSimulation, state, auditLog] = await Promise.all([
      this.application.simulateMultiResolution(workflowId, input.nodeIds, input.resolvedAt),
      this.application.getState(workflowId),
      this.application.getAuditLog(workflowId),
    ]);
    return {
      summary: `Simulation resolves ${multiSimulation.resolvedNodeIds.length} node${multiSimulation.resolvedNodeIds.length === 1 ? '' : 's'} and projects health changing from ${multiSimulation.before.healthScore} to ${multiSimulation.after.healthScore}; live state is unchanged.`,
      multiSimulation,
      ...createDashboardData({
        state,
        analysis: multiSimulation.before,
        simulation: multiSimulation,
        auditLog,
        liveTool: 'what_if_multi',
      }),
    };
  }

  @Widget({ route: 'handoff-dashboard', prefersBorder: false })
  @Tool({
    name: 'get_owner_workload',
    description: 'Aggregate open workflow nodes and active findings for an owner across workflows.',
    inputSchema: getOwnerWorkloadSchema,
    outputSchema: getOwnerWorkloadOutputSchema,
  })
  async getOwnerWorkload(input: GetOwnerWorkloadInput, context: ExecutionContext) {
    context.logger.info('Getting owner workload', { ownerId: input.ownerId, workflowIds: input.workflowIds });
    const workload = await this.application.getOwnerWorkload(input.ownerId, input.workflowIds);
    const dashboardWorkflowId = input.workflowIds?.[0] ?? defaultWorkflowId;
    const [state, analysis, auditLog] = await Promise.all([
      this.application.getState(dashboardWorkflowId),
      this.application.detectBlockers(dashboardWorkflowId),
      this.application.getAuditLog(dashboardWorkflowId),
    ]);
    return {
      summary: `${workload.ownerId} owns ${workload.openNodeIds.length} open node${workload.openNodeIds.length === 1 ? '' : 's'} and ${workload.activeFindingIds.length} active finding${workload.activeFindingIds.length === 1 ? '' : 's'}.`,
      workload,
      ...createDashboardData({ state, analysis, auditLog, liveTool: 'get_owner_workload' }),
    };
  }

  @Tool({
    name: 'subscribe_alerts',
    description: 'Register an in-memory alert subscription for a workflow metric threshold.',
    inputSchema: subscribeAlertsSchema,
    outputSchema: subscribeAlertsOutputSchema,
  })
  async subscribeAlerts(input: SubscribeAlertsInput, context: ExecutionContext) {
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Registering workflow alert subscription', { workflowId, metric: input.metric, subscriberId: input.subscriberId });
    const subscription = await this.application.subscribeAlerts({
      workflowId,
      metric: input.metric,
      comparator: input.comparator,
      threshold: input.threshold,
      subscriberId: input.subscriberId,
    });
    return {
      summary: `Alert subscription ${subscription.id} is active for ${subscription.metric} ${subscription.comparator} ${subscription.threshold}.`,
      subscription,
    };
  }

  @Tool({
    name: 'export_audit_report',
    description: 'Export a structured JSON and Markdown audit report for a workflow.',
    inputSchema: exportAuditReportSchema,
    outputSchema: exportAuditReportOutputSchema,
  })
  async exportAuditReport(input: ExportAuditReportInput, context: ExecutionContext) {
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Exporting workflow audit report', { workflowId });
    const report = await this.application.exportAuditReport(workflowId);
    return {
      summary: `Exported audit report for ${workflowId} with ${report.findings.length} active findings and ${report.auditLog.length} audit entries.`,
      report,
    };
  }

  @Tool({
    name: 'verify_audit_integrity',
    description: 'Verify the tamper-evident SHA-256 audit chain for a workflow.',
    inputSchema: verifyAuditIntegritySchema,
    outputSchema: verifyAuditIntegrityOutputSchema,
  })
  async verifyAuditIntegrity(input: VerifyAuditIntegrityInput, context: ExecutionContext) {
    const workflowId = resolveWorkflowId(input);
    context.logger.info('Verifying workflow audit integrity', { workflowId });
    const integrity = await this.application.verifyAuditIntegrity(workflowId);
    return {
      summary: integrity.valid
        ? `Audit chain is valid across ${integrity.checkedEntries} entries.`
        : `Audit chain validation failed at ${integrity.firstInvalidEntryId ?? 'an unknown entry'} (${integrity.reason ?? 'unknown reason'}).`,
      integrity,
    };
  }
}
