import type {
  ActionExecutionResult,
  ActionPort,
  AnalysisPort,
  AuditEntry,
  AuditPort,
  BlockerAnalysis,
  FindingSnapshot,
  PlannedAction,
  RuleDefinition,
  SimulationResult,
  WorkflowEventInput,
  WorkflowId,
  WorkflowPort,
  WorkflowStateSnapshot,
} from './contracts.js';

export class IntegrationPendingError extends Error {
  constructor(capability: string) {
    super(`${capability} is unavailable until the workflow domain and rules services are integrated.`);
    this.name = 'IntegrationPendingError';
  }
}

const integrationPending = (): never => {
  throw new IntegrationPendingError('HandoffOS workflow intelligence');
};

const unavailableWorkflowPort: WorkflowPort = {
  getState: integrationPending,
  getEvents: integrationPending,
  ingestEvent: integrationPending,
};

const unavailableAnalysisPort: AnalysisPort = {
  getFindings: integrationPending,
  getRules: integrationPending,
  detectBlockers: integrationPending,
  simulateResolution: integrationPending,
};

const unavailableActionPort: ActionPort = {
  planNextActions: integrationPending,
  executeAction: integrationPending,
};

const unavailableAuditPort: AuditPort = {
  getAuditLog: integrationPending,
};

export class HandoffOSApplication {
  private readonly plannedActionsByWorkflow = new Map<WorkflowId, Map<string, PlannedAction>>();

  constructor(
    private readonly workflow: WorkflowPort = unavailableWorkflowPort,
    private readonly analysis: AnalysisPort = unavailableAnalysisPort,
    private readonly actions: ActionPort = unavailableActionPort,
    private readonly audit: AuditPort = unavailableAuditPort,
  ) { }

  getState(workflowId: WorkflowId): Promise<WorkflowStateSnapshot> {
    return this.workflow.getState(workflowId);
  }

  getEvents(workflowId: WorkflowId): Promise<WorkflowEventInput[]> {
    return this.workflow.getEvents(workflowId);
  }

  getFindings(workflowId: WorkflowId): Promise<FindingSnapshot[]> {
    return this.analysis.getFindings(workflowId);
  }

  getAuditLog(workflowId: WorkflowId): Promise<AuditEntry[]> {
    return this.audit.getAuditLog(workflowId);
  }

  getRules(): Promise<RuleDefinition[]> {
    return this.analysis.getRules();
  }

  ingestEvent(workflowId: WorkflowId, event: WorkflowEventInput): Promise<WorkflowStateSnapshot> {
    return this.workflow.ingestEvent(workflowId, event);
  }

  detectBlockers(workflowId: WorkflowId): Promise<BlockerAnalysis> {
    return this.analysis.detectBlockers(workflowId);
  }

  simulateResolution(
    workflowId: WorkflowId,
    nodeId: string,
    resolvedAt: string,
  ): Promise<SimulationResult> {
    return this.analysis.simulateResolution(workflowId, nodeId, resolvedAt);
  }

  async planNextActions(workflowId: WorkflowId): Promise<PlannedAction[]> {
    const plannedActions = await this.actions.planNextActions(workflowId);
    this.plannedActionsByWorkflow.set(
      workflowId,
      new Map(plannedActions.map((action) => [action.id, action])),
    );
    return plannedActions;
  }

  async executeAction(
    workflowId: WorkflowId,
    actionId: string,
    approvedBy: string,
  ): Promise<ActionExecutionResult> {
    if (!approvedBy.trim()) {
      throw new Error('An approver is required to execute an action.');
    }

    const plannedAction = this.plannedActionsByWorkflow.get(workflowId)?.get(actionId);
    if (!plannedAction) {
      throw new Error('Action must be returned by plan_next_actions before execution.');
    }

    const result = await this.actions.executeAction(workflowId, actionId, approvedBy);
    this.plannedActionsByWorkflow.get(workflowId)?.delete(actionId);
    return result;
  }
}

export const handoffOSApplication = new HandoffOSApplication();
