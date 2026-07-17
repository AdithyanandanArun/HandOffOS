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
import { Injectable } from '@nitrostack/core';
import { HandoffOSRuntime } from './handoffos.runtime.js';

@Injectable({ deps: [HandoffOSRuntime] })
export class HandoffOSApplication {
  private readonly plannedActionsByWorkflow = new Map<WorkflowId, Map<string, PlannedAction>>();

  constructor(private readonly runtime: WorkflowPort & AnalysisPort & ActionPort & AuditPort) {}

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
}

export function createHandoffOSApplication(runtime = new HandoffOSRuntime()): HandoffOSApplication {
  return new HandoffOSApplication(runtime);
}
