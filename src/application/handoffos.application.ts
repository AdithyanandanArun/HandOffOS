import type {
  ActionExecutionResult,
  ActionPort,
  AnalysisPort,
  AlertSubscriptionResult,
  AuditReport,
  AuditIntegrityResult,
  AuditEntry,
  AuditPort,
  BlockerAnalysis,
  CompletionForecast,
  EscalationPayload,
  FindingSnapshot,
  PlannedAction,
  Phase2Port,
  MultiSimulationResult,
  OwnerWorkloadResult,
  RollbackActionResult,
  RuleDefinition,
  SimulationResult,
  WorkflowEventInput,
  WorkflowId,
  WorkflowPort,
  WorkflowComparison,
  WorkflowStateSnapshot,
} from './contracts.js';
import { Injectable } from '@nitrostack/core';
import { HandoffOSRuntime } from './handoffos.runtime.js';

@Injectable({ deps: [HandoffOSRuntime] })
export class HandoffOSApplication {
  private readonly plannedActionsByWorkflow = new Map<WorkflowId, Map<string, PlannedAction>>();

  constructor(private readonly runtime: WorkflowPort & AnalysisPort & ActionPort & AuditPort & Phase2Port) {}

  getState(workflowId: WorkflowId): Promise<WorkflowStateSnapshot> {
    return this.runtime.getState(workflowId);
  }

  getEvents(workflowId: WorkflowId): Promise<WorkflowEventInput[]> {
    return this.runtime.getEvents(workflowId);
  }

  getFindings(workflowId: WorkflowId): Promise<FindingSnapshot[]> {
    return this.runtime.getFindings(workflowId);
  }

  getAuditLog(workflowId: WorkflowId): Promise<AuditEntry[]> {
    return this.runtime.getAuditLog(workflowId);
  }

  verifyAuditIntegrity(workflowId: WorkflowId): Promise<AuditIntegrityResult> {
    return this.runtime.verifyAuditIntegrity(workflowId);
  }

  getRules(): Promise<RuleDefinition[]> {
    return this.runtime.getRules();
  }

  ingestEvent(workflowId: WorkflowId, event: WorkflowEventInput): Promise<WorkflowStateSnapshot> {
    return this.runtime.ingestEvent(workflowId, event);
  }

  detectBlockers(workflowId: WorkflowId): Promise<BlockerAnalysis> {
    return this.runtime.detectBlockers(workflowId);
  }

  simulateResolution(
    workflowId: WorkflowId,
    nodeId: string,
    resolvedAt: string,
  ): Promise<SimulationResult> {
    return this.runtime.simulateResolution(workflowId, nodeId, resolvedAt);
  }

  async planNextActions(workflowId: WorkflowId): Promise<PlannedAction[]> {
    const plannedActions = await this.runtime.planNextActions(workflowId);
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

    const result = await this.runtime.executeAction(workflowId, actionId, approvedBy);
    this.plannedActionsByWorkflow.get(workflowId)?.delete(actionId);
    return result;
  }

  escalateBlocker(workflowId: WorkflowId): Promise<EscalationPayload> {
    return this.runtime.escalateBlocker(workflowId);
  }

  predictCompletion(workflowId: WorkflowId): Promise<CompletionForecast> {
    return this.runtime.predictCompletion(workflowId);
  }

  compareWorkflows(workflowIds?: WorkflowId[]): Promise<WorkflowComparison[]> {
    return this.runtime.compareWorkflows(workflowIds);
  }

  rollbackAction(workflowId: WorkflowId, approvedBy: string): Promise<RollbackActionResult> {
    return this.runtime.rollbackAction(workflowId, approvedBy);
  }

  simulateMultiResolution(workflowId: WorkflowId, nodeIds: string[], resolvedAt: string): Promise<MultiSimulationResult> {
    return this.runtime.simulateMultiResolution(workflowId, nodeIds, resolvedAt);
  }

  getOwnerWorkload(ownerId: string, workflowIds?: WorkflowId[]): Promise<OwnerWorkloadResult> {
    return this.runtime.getOwnerWorkload(ownerId, workflowIds);
  }

  subscribeAlerts(input: Omit<AlertSubscriptionResult, 'id' | 'createdAt'>): Promise<AlertSubscriptionResult> {
    return this.runtime.subscribeAlerts(input);
  }

  exportAuditReport(workflowId: WorkflowId): Promise<AuditReport> {
    return this.runtime.exportAuditReport(workflowId);
  }
}

export function createHandoffOSApplication(runtime = new HandoffOSRuntime()): HandoffOSApplication {
  return new HandoffOSApplication(runtime);
}
