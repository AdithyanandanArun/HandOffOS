import { Injectable } from '@nitrostack/core';
import { analyzeWorkflow, applyAnalysis, predictCompletion } from '../analysis/analyze.js';
import { simulateMultiResolution, simulateResolution } from '../analysis/simulate.js';
import { demoNow } from '../domain/demo-clock.js';
import type {
  AuditEntry as DomainAuditEntry,
  Evidence,
  Finding,
  NodeStatus,
  SourceEvent,
  WorkflowState,
} from '../domain/types.js';
import { ALL_RULES } from '../rules/engine.js';
import { AlertSubscriptionStore } from '../workflow/alerts.js';
import { createSeedStates } from '../workflow/seed.js';
import { InMemoryWorkflowStateStore, type WorkflowStateStore } from '../workflow/state-store.js';
import { appendAuditEntry, verifyAuditIntegrity } from '../workflow/audit.js';
import { getOwnerWorkload } from '../workflow/workload.js';
import type {
  ActionExecutionResult,
  ActionPort,
  AnalysisPort,
  AlertSubscriptionResult,
  AuditReport,
  AuditEntry,
  AuditIntegrityResult,
  AuditPort,
  BlockerAnalysis,
  EvidenceReference,
  EscalationPayload,
  FindingSnapshot,
  PlannedAction,
  Phase2Port,
  CompletionForecast,
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

function requireState(store: WorkflowStateStore, workflowId: WorkflowId): WorkflowState {
  const state = store.getState(workflowId);
  if (!state) {
    throw new Error(`Workflow "${workflowId}" was not found.`);
  }
  rehydrateDates(state);
  return state;
}

// The shared in-memory store clones through JSON to protect its internal state.
// Restore Date values at the MCP boundary before deterministic rule evaluation.
function rehydrateDates(state: WorkflowState): void {
  state.targetDate = new Date(state.targetDate);
  if (state.estimatedCompletion) state.estimatedCompletion = new Date(state.estimatedCompletion);
  for (const node of state.nodes) {
    if (node.sla) node.sla = new Date(node.sla);
    if (node.completedAt) node.completedAt = new Date(node.completedAt);
  }
  for (const event of state.events) event.timestamp = new Date(event.timestamp);
  for (const evidence of state.evidence) evidence.timestamp = new Date(evidence.timestamp);
  for (const entry of state.auditLog) entry.timestamp = new Date(entry.timestamp);
}

function toIso(value: Date | null | undefined): string {
  return (value ?? demoNow()).toISOString();
}

function toWorkflowEvent(event: SourceEvent): WorkflowEventInput {
  return {
    id: event.id,
    source: event.source === 'hr-system' ? 'hr' : event.source,
    type: event.type,
    timestamp: event.timestamp.toISOString(),
    actor: event.actor,
    payload: {
      ...event.payload,
      ...(event.nodeId ? { nodeId: event.nodeId } : {}),
      ...(event.logicalTaskKey ? { logicalTaskKey: event.logicalTaskKey } : {}),
      ...(event.reportedStatus ? { reportedStatus: event.reportedStatus } : {}),
    },
    evidenceId: event.evidenceId,
  };
}

function toSourceEvent(event: WorkflowEventInput): SourceEvent {
  const nodeId = typeof event.payload.nodeId === 'string' ? event.payload.nodeId : undefined;
  const logicalTaskKey = typeof event.payload.logicalTaskKey === 'string' ? event.payload.logicalTaskKey : undefined;
  const reportedStatus = isNodeStatus(event.payload.reportedStatus)
    ? event.payload.reportedStatus
    : isNodeStatus(event.payload.status) ? event.payload.status : undefined;
  return {
    ...event,
    source: event.source === 'hr' ? 'hr-system' : event.source,
    timestamp: new Date(event.timestamp),
    nodeId,
    logicalTaskKey,
    reportedStatus,
  };
}

function toFinding(finding: Finding): FindingSnapshot {
  return {
    id: finding.id,
    ruleId: finding.ruleId,
    severity: finding.severity,
    title: finding.title,
    explanation: finding.explanation,
    evidenceIds: [...finding.evidenceIds],
    affectedNodeIds: [...finding.affectedNodeIds],
    riskPoints: finding.riskPoints,
    confidence: finding.confidence ?? 'weak',
  };
}

function workflowStatus(state: WorkflowState): WorkflowStateSnapshot['status'] {
  if (state.rootBlocker) return 'blocked';
  return state.health < 90 ? 'at_risk' : 'healthy';
}

function toStateSnapshot(state: WorkflowState, updatedAt: Date): WorkflowStateSnapshot {
  return {
    workflowId: state.workflowId,
    employee: state.subject,
    joiningDate: state.targetDate.toISOString(),
    status: workflowStatus(state),
    healthScore: state.health,
    mainBlocker: state.rootBlocker ?? undefined,
    estimatedCompletion: toIso(state.estimatedCompletion),
    nodes: state.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      owner: node.owner || null,
      status: node.status,
      dependsOn: [...node.dependencies],
      slaHours: node.sla
        ? Math.round((node.sla.getTime() - demoNow().getTime()) / (60 * 60 * 1000))
        : 0,
      completedAt: node.completedAt?.toISOString(),
    })),
    updatedAt: updatedAt.toISOString(),
    targetDate: state.targetDate.toISOString(),
  };
}

function evidenceForFindings(state: WorkflowState, findings: Finding[]): EvidenceReference[] {
  const referencedIds = new Set(findings.flatMap((finding) => finding.evidenceIds));
  return state.evidence
    .filter((evidence) => referencedIds.has(evidence.id))
    .map((evidence) => ({ id: evidence.id, summary: evidence.description }));
}

function toAnalysis(state: WorkflowState): BlockerAnalysis {
  const analysis = analyzeWorkflow(state);
  return {
    workflowId: state.workflowId,
    findings: analysis.findings.map(toFinding),
    evidence: evidenceForFindings(state, analysis.findings),
    healthScore: analysis.health,
    healthBreakdown: analysis.healthBreakdown.map((item) => ({
      label: `${item.ruleId} (${item.findingId})`,
      riskPoints: item.riskPoints,
    })),
    mainBlocker: analysis.rootBlocker ?? undefined,
    criticalPath: analysis.criticalPath,
    estimatedCompletion: toIso(analysis.estimatedCompletion),
  };
}

function toAuditEntry(entry: DomainAuditEntry): AuditEntry {
  return {
    id: entry.id,
    timestamp: entry.timestamp.toISOString(),
    action: entry.action,
    actor: entry.actor,
    details: typeof entry.details.summary === 'string'
      ? entry.details.summary
      : JSON.stringify(entry.details),
    previousHash: entry.previousHash,
    hash: entry.hash,
  };
}

function propagateReadyStatuses(state: WorkflowState): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of state.nodes) {
      if (node.status === 'completed' || node.status === 'in_progress') continue;
      const dependencies = node.dependencies.map((dependencyId) =>
        state.nodes.find((candidate) => candidate.id === dependencyId),
      );
      const anyDependencyBlocked = dependencies.some((dependency) => !dependency || dependency.status === 'blocked');
      const allDependenciesComplete = dependencies.every((dependency) => dependency?.status === 'completed');

      if (anyDependencyBlocked && node.status !== 'blocked') {
        node.status = 'blocked';
        changed = true;
      } else if (allDependenciesComplete && (node.status === 'blocked' || node.status === 'pending')) {
        node.status = 'ready';
        changed = true;
      }
    }
  }
}

function isNodeStatus(value: unknown): value is NodeStatus {
  return value === 'completed' || value === 'blocked' || value === 'pending'
    || value === 'ready' || value === 'in_progress';
}

function eventEvidence(event: SourceEvent): Evidence {
  return {
    id: event.evidenceId,
    sourceEventId: event.id,
    type: 'event',
    description: `Event "${event.type}" received from ${event.source} by ${event.actor}.`,
    timestamp: event.timestamp,
  };
}

@Injectable()
export class HandoffOSRuntime implements WorkflowPort, AnalysisPort, ActionPort, AuditPort, Phase2Port {
  private readonly updatedAtByWorkflow = new Map<WorkflowId, Date>();
  private readonly store: WorkflowStateStore;
  private readonly alertSubscriptions = new AlertSubscriptionStore();
  private nextSubscriptionNumber = 1;

  constructor() {
    this.store = new InMemoryWorkflowStateStore();
    for (const seedState of createSeedStates()) {
      const seed = applyAnalysis(seedState);
      this.store.setState(seed);
      this.updatedAtByWorkflow.set(seed.workflowId, demoNow());
    }
  }

  async getState(workflowId: WorkflowId): Promise<WorkflowStateSnapshot> {
    return toStateSnapshot(requireState(this.store, workflowId), this.updatedAt(workflowId));
  }

  async getEvents(workflowId: WorkflowId): Promise<WorkflowEventInput[]> {
    return requireState(this.store, workflowId).events.map(toWorkflowEvent);
  }

  async ingestEvent(workflowId: WorkflowId, event: WorkflowEventInput): Promise<WorkflowStateSnapshot> {
    const state = requireState(this.store, workflowId);
    if (state.events.some((existing) => existing.id === event.id)) {
      throw new Error(`Event "${event.id}" has already been ingested.`);
    }

    const sourceEvent = toSourceEvent(event);
    state.events.push(sourceEvent);
    if (!state.evidence.some((existing) => existing.id === sourceEvent.evidenceId)) {
      state.evidence.push(eventEvidence(sourceEvent));
    }

    const nodeId = event.payload.nodeId;
    const status = event.payload.status;
    if (typeof nodeId === 'string' && isNodeStatus(status)) {
      const node = state.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) throw new Error(`Node "${nodeId}" was not found in workflow "${workflowId}".`);
      node.status = status;
      if (status === 'completed') node.completedAt = sourceEvent.timestamp;
      if (!node.evidenceIds.includes(sourceEvent.evidenceId)) node.evidenceIds.push(sourceEvent.evidenceId);
      propagateReadyStatuses(state);
    }

    const updatedAt = sourceEvent.timestamp;
    appendAuditEntry(state, {
      id: `AUD-${state.auditLog.length + 1}`,
      timestamp: updatedAt,
      action: 'Enterprise event ingested',
      actor: sourceEvent.actor,
      details: { summary: `Ingested ${sourceEvent.type} from ${sourceEvent.source}.`, eventId: sourceEvent.id },
    });
    this.commit(state, updatedAt);
    return this.getState(workflowId);
  }

  async getFindings(workflowId: WorkflowId): Promise<FindingSnapshot[]> {
    return toAnalysis(requireState(this.store, workflowId)).findings;
  }

  async getRules(): Promise<RuleDefinition[]> {
    return ALL_RULES.map((rule) => ({
      id: rule.id,
      name: rule.title,
      description: rule.description,
    }));
  }

  async detectBlockers(workflowId: WorkflowId): Promise<BlockerAnalysis> {
    return toAnalysis(requireState(this.store, workflowId));
  }

  async simulateResolution(
    workflowId: WorkflowId,
    nodeId: string,
    resolvedAt: string,
  ): Promise<SimulationResult> {
    const state = requireState(this.store, workflowId);
    const result = simulateResolution(state, nodeId, new Date(resolvedAt));
    const afterAnalysis = {
      workflowId,
      findings: result.afterFindings.map(toFinding),
      evidence: evidenceForFindings(state, result.afterFindings),
      healthScore: result.afterHealth,
      healthBreakdown: result.afterFindings
        .filter((finding) => finding.riskPoints > 0)
        .map((finding) => ({ label: `${finding.ruleId} (${finding.id})`, riskPoints: finding.riskPoints })),
      mainBlocker: undefined,
      criticalPath: result.criticalPath,
      estimatedCompletion: toIso(result.completionEstimate),
    } satisfies BlockerAnalysis;

    return {
      workflowId,
      before: toAnalysis(state),
      after: afterAnalysis,
      resolvedFindingIds: result.findingsDelta.resolved.map((finding) => finding.id),
      introducedFindingIds: result.findingsDelta.introduced.map((finding) => finding.id),
    };
  }

  async planNextActions(workflowId: WorkflowId): Promise<PlannedAction[]> {
    const state = requireState(this.store, workflowId);
    const analysis = toAnalysis(state);
    if (!analysis.mainBlocker) return [];
    const blocker = state.nodes.find((node) => node.id === analysis.mainBlocker);
    if (!blocker) return [];

    return [{
      id: `resolve-${blocker.id}`,
      title: `Complete ${blocker.label}`,
      owner: blocker.owner || 'Unassigned',
      evidenceIds: analysis.findings
        .filter((finding) => finding.affectedNodeIds.includes(analysis.mainBlocker!))
        .flatMap((finding) => finding.evidenceIds)
        .filter((id, index, ids) => ids.indexOf(id) === index),
      expectedImpact: `Completes ${blocker.label}, recalculates deterministic findings, and releases eligible downstream work.`,
      requiresApproval: true,
    }];
  }

  async executeAction(
    workflowId: WorkflowId,
    actionId: string,
    approvedBy: string,
  ): Promise<ActionExecutionResult> {
    if (!actionId.startsWith('resolve-')) {
      throw new Error(`Action "${actionId}" is not executable for this workflow.`);
    }

    const state = requireState(this.store, workflowId);
    const nodeId = actionId.slice('resolve-'.length);
    const targetNode = state.nodes.find((node) => node.id === nodeId);
    if (!targetNode) throw new Error(`Workflow node "${nodeId}" is missing from the workflow.`);
    if (targetNode.status === 'completed') throw new Error(`Workflow node "${nodeId}" is already completed.`);

    const beforeHealth = analyzeWorkflow(state).health;
    const completedAt = demoNow();
    this.store.recordHistory(workflowId, state);
    targetNode.status = 'completed';
    targetNode.completedAt = completedAt;
    propagateReadyStatuses(state);

    const recalculated = applyAnalysis(state);
    const auditEntry = appendAuditEntry(recalculated, {
      id: `AUD-${recalculated.auditLog.length + 1}`,
      timestamp: completedAt,
      action: `${targetNode.label} completed`,
      actor: approvedBy,
      details: {
        summary: `Approved action completed ${targetNode.label} and recalculated workflow health from ${beforeHealth} to ${recalculated.health}.`,
        actionId,
        nodeId: targetNode.id,
        beforeHealth,
        afterHealth: recalculated.health,
      },
    });
    this.commit(recalculated, completedAt);

    return {
      workflowId,
      actionId,
      approvedBy,
      summary: `${targetNode.label} completed. Workflow health changed from ${beforeHealth} to ${recalculated.health}.`,
      state: await this.getState(workflowId),
      auditEntry: toAuditEntry(auditEntry),
    };
  }

  async escalateBlocker(workflowId: WorkflowId): Promise<EscalationPayload> {
    const state = requireState(this.store, workflowId);
    const analysis = toAnalysis(state);
    const nodeId = analysis.mainBlocker;
    if (!nodeId) throw new Error(`Workflow "${workflowId}" has no blocker to escalate.`);
    const node = state.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) throw new Error(`Workflow node "${nodeId}" was not found.`);
    const breachHours = node.sla
      ? Math.max(0, Math.floor((demoNow().getTime() - node.sla.getTime()) / (60 * 60 * 1000)))
      : 0;
    const findings = analysis.findings.filter((finding) => finding.affectedNodeIds.includes(nodeId));

    return {
      workflowId,
      nodeId,
      nodeLabel: node.label,
      owningTeam: node.owner || 'Unassigned',
      slaDeadline: node.sla?.toISOString(),
      breachHours,
      evidenceIds: [...new Set(findings.flatMap((finding) => finding.evidenceIds))],
      findingIds: findings.map((finding) => finding.id),
      summary: `${node.label} is the root blocker owned by ${node.owner || 'an unassigned team'}${breachHours ? ` and is ${breachHours} hours beyond SLA` : ''}.`,
    };
  }

  async predictCompletion(workflowId: WorkflowId): Promise<CompletionForecast> {
    const forecast = predictCompletion(requireState(this.store, workflowId));
    return {
      workflowId,
      estimatedCompletion: toIso(forecast.estimatedCompletion),
      criticalPath: forecast.criticalPath,
      delayDrivers: forecast.delayDrivers.map((driver) => ({
        nodeId: driver.nodeId,
        reasons: driver.reasons,
        sla: driver.sla?.toISOString(),
      })),
    };
  }

  async compareWorkflows(workflowIds?: WorkflowId[]): Promise<WorkflowComparison[]> {
    const ids = workflowIds?.length ? [...new Set(workflowIds)] : this.store.listWorkflowIds();
    return ids.map((workflowId) => {
      const state = requireState(this.store, workflowId);
      const analysis = toAnalysis(state);
      return {
        workflowId,
        subject: state.subject,
        healthScore: analysis.healthScore,
        mainBlocker: analysis.mainBlocker,
        estimatedCompletion: analysis.estimatedCompletion,
        criticalPath: analysis.criticalPath,
      };
    });
  }

  async rollbackAction(workflowId: WorkflowId, approvedBy: string): Promise<RollbackActionResult> {
    if (!approvedBy.trim()) throw new Error('An approver is required to roll back an action.');
    const current = requireState(this.store, workflowId);
    const retainedAuditLog = current.auditLog;
    const revertedEntry = retainedAuditLog.at(-1);
    const restored = this.store.restorePreviousState(workflowId);
    if (!restored) throw new Error(`Workflow "${workflowId}" has no prior approved action to roll back.`);
    rehydrateDates(restored);
    restored.auditLog = retainedAuditLog;
    const rolledBackAt = demoNow();
    const recalculated = applyAnalysis(restored);
    const auditEntry = appendAuditEntry(recalculated, {
      id: `AUD-${recalculated.auditLog.length + 1}`,
      timestamp: rolledBackAt,
      action: 'Approved action rolled back',
      actor: approvedBy,
      details: {
        summary: 'Restored the workflow state before the most recent approved action without removing audit history.',
        workflowId,
        revertedAuditEntryId: revertedEntry?.id,
      },
    });
    this.store.setState(recalculated);
    this.updatedAtByWorkflow.set(workflowId, rolledBackAt);

    return {
      workflowId,
      approvedBy,
      summary: 'Restored the state before the most recent approved action.',
      state: await this.getState(workflowId),
      auditEntry: toAuditEntry(auditEntry),
    };
  }

  async simulateMultiResolution(
    workflowId: WorkflowId,
    nodeIds: string[],
    resolvedAt: string,
  ): Promise<MultiSimulationResult> {
    const state = requireState(this.store, workflowId);
    const result = simulateMultiResolution(state, nodeIds, new Date(resolvedAt));
    const after: BlockerAnalysis = {
      workflowId,
      findings: result.afterFindings.map(toFinding),
      evidence: evidenceForFindings(state, result.afterFindings),
      healthScore: result.afterHealth,
      healthBreakdown: result.afterFindings
        .filter((finding) => finding.riskPoints > 0)
        .map((finding) => ({ label: `${finding.ruleId} (${finding.id})`, riskPoints: finding.riskPoints })),
      criticalPath: result.criticalPath,
      estimatedCompletion: toIso(result.completionEstimate),
    };
    return {
      workflowId,
      resolvedNodeIds: result.resolvedNodeIds,
      before: toAnalysis(state),
      after,
      resolvedFindingIds: result.findingsDelta.resolved.map((finding) => finding.id),
      introducedFindingIds: result.findingsDelta.introduced.map((finding) => finding.id),
    };
  }

  async getOwnerWorkload(ownerId: string, workflowIds?: WorkflowId[]): Promise<OwnerWorkloadResult> {
    const states = this.store.getStates(workflowIds);
    for (const state of states) rehydrateDates(state);
    const workload = getOwnerWorkload(states, ownerId);
    return workload;
  }

  async subscribeAlerts(input: Omit<AlertSubscriptionResult, 'id' | 'createdAt'>): Promise<AlertSubscriptionResult> {
    requireState(this.store, input.workflowId);
    const subscription = this.alertSubscriptions.add({
      ...input,
      id: `SUB-${String(this.nextSubscriptionNumber++).padStart(3, '0')}`,
      createdAt: demoNow(),
    });
    return { ...subscription, createdAt: subscription.createdAt.toISOString() };
  }

  async exportAuditReport(workflowId: WorkflowId): Promise<AuditReport> {
    const state = await this.getState(workflowId);
    const findings = await this.getFindings(workflowId);
    const auditLog = await this.getAuditLog(workflowId);
    const integrity = await this.verifyAuditIntegrity(workflowId);
    const markdown = [
      `# HandoffOS Audit Report: ${state.employee}`,
      '',
      `- Workflow: ${workflowId}`,
      `- Health: ${state.healthScore}/100`,
      `- Main blocker: ${state.mainBlocker ?? 'None'}`,
      `- Estimated completion: ${state.estimatedCompletion}`,
      '',
      '## Findings',
      ...findings.map((finding) => `- ${finding.ruleId} (${finding.confidence}): ${finding.title}`),
      '',
      '## Audit Log',
      ...auditLog.map((entry) => `- ${entry.timestamp} | ${entry.actor} | ${entry.action} | ${entry.details}`),
      '',
      '## Integrity',
      `- Audit chain valid: ${integrity.valid}`,
      `- Entries checked: ${integrity.checkedEntries}`,
      ...(integrity.latestHash ? [`- Latest hash: ${integrity.latestHash}`] : []),
    ].join('\n');
    return { workflowId, generatedAt: demoNow().toISOString(), state, findings, auditLog, integrity, markdown };
  }

  async getAuditLog(workflowId: WorkflowId): Promise<AuditEntry[]> {
    return requireState(this.store, workflowId).auditLog.map(toAuditEntry);
  }

  async verifyAuditIntegrity(workflowId: WorkflowId): Promise<AuditIntegrityResult> {
    const integrity = verifyAuditIntegrity(requireState(this.store, workflowId).auditLog);
    return { workflowId, ...integrity };
  }

  private commit(state: WorkflowState, updatedAt: Date): void {
    this.store.setState(applyAnalysis(state));
    this.updatedAtByWorkflow.set(state.workflowId, new Date(updatedAt));
  }

  private updatedAt(workflowId: WorkflowId): Date {
    return this.updatedAtByWorkflow.get(workflowId) ?? demoNow();
  }
}
