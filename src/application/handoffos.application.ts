import type {
  ActionExecutionResult,
  AuthorizationContext,
  ActionPort,
  AnalysisPort,
  AlertSubscriptionResult,
  AuditReport,
  AuditIntegrityResult,
  AuditEntry,
  AuditPort,
  BlockerAnalysis,
  CompletionForecast,
  DemoPort,
  DemoResetResult,
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
import { PolicyService } from '../security/index.js';
import type { Capability, Principal } from '../security/index.js';
import { HandoffOSRuntime } from './handoffos.runtime.js';

@Injectable({ deps: [HandoffOSRuntime] })
export class HandoffOSApplication {
  private readonly plannedActionsByWorkflow = new Map<WorkflowId, Map<string, PlannedAction>>();
  private readonly policy = new PolicyService();

  constructor(private readonly runtime: WorkflowPort & AnalysisPort & ActionPort & AuditPort & DemoPort & Phase2Port) {}

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

  async resetDemo(principalId: string): Promise<DemoResetResult> {
    const authContext = this.authorize(principalId, 'reset_demo');
    const result = await this.runtime.resetDemo(authContext.displayName);
    this.plannedActionsByWorkflow.clear();
    return result;
  }

  getRules(): Promise<RuleDefinition[]> {
    return this.runtime.getRules();
  }

  async ingestEvent(workflowId: WorkflowId, event: WorkflowEventInput, principalId: string): Promise<WorkflowStateSnapshot> {
    this.authorize(principalId, 'ingest_event');
    return this.runtime.ingestEvent(workflowId, event);
  }

  authorize(principalId: string, capability: Capability): AuthorizationContext {
    const principal = this.policy.authorize(principalId, capability);
    return this.toAuthorizationContext(principal, capability);
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
    principalId: string,
  ): Promise<ActionExecutionResult> {
    if (!principalId || !principalId.trim()) {
      throw new Error('An approver is required to execute this action.');
    }
    const authContext = this.authorize(principalId, 'execute_action');

    const plannedAction = this.plannedActionsByWorkflow.get(workflowId)?.get(actionId);
    if (!plannedAction) {
      throw new Error('Action must be returned by plan_next_actions before execution.');
    }

    const result = await this.runtime.executeAction(workflowId, actionId, authContext.displayName);
    this.plannedActionsByWorkflow.get(workflowId)?.delete(actionId);
    return {
      ...result,
      principalId,
    };
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

  async rollbackAction(workflowId: WorkflowId, principalId: string): Promise<RollbackActionResult> {
    const authContext = this.authorize(principalId, 'rollback_action');
    const result = await this.runtime.rollbackAction(workflowId, authContext.displayName);
    return {
      ...result,
      principalId,
    };
  }

  simulateMultiResolution(workflowId: WorkflowId, nodeIds: string[], resolvedAt: string): Promise<MultiSimulationResult> {
    return this.runtime.simulateMultiResolution(workflowId, nodeIds, resolvedAt);
  }

  getOwnerWorkload(ownerId: string, workflowIds?: WorkflowId[]): Promise<OwnerWorkloadResult> {
    return this.runtime.getOwnerWorkload(ownerId, workflowIds);
  }

  async subscribeAlerts(input: Omit<AlertSubscriptionResult, 'id' | 'createdAt'>, principalId: string): Promise<AlertSubscriptionResult> {
    this.authorize(principalId, 'subscribe_alerts');
    return this.runtime.subscribeAlerts(input);
  }

  exportAuditReport(workflowId: WorkflowId): Promise<AuditReport> {
    return this.runtime.exportAuditReport(workflowId);
  }

  private toAuthorizationContext(principal: Principal, capability: Capability): AuthorizationContext {
    return {
      principalId: principal.id,
      displayName: principal.displayName,
      roles: [...principal.roles],
      capability,
    };
  }
}

export function createHandoffOSApplication(runtime = new HandoffOSRuntime()): HandoffOSApplication {
  return new HandoffOSApplication(runtime);
}
