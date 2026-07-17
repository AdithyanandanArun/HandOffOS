import { Injectable } from '@nitrostack/core';
import { analyzeWorkflow, applyAnalysis } from '../analysis/analyze.js';
import { simulateResolution } from '../analysis/simulate.js';
import { demoNow, PRIYA_JOINING_DATE } from '../domain/demo-clock.js';
import type {
  AuditEntry as DomainAuditEntry,
  Evidence,
  Finding,
  NodeStatus,
  SourceEvent,
  WorkflowState,
} from '../domain/types.js';
import { ALL_RULES } from '../rules/engine.js';
import { createSeedState, createVendorSeedState } from '../workflow/seed.js';
import { InMemoryWorkflowStateStore, type WorkflowStateStore } from '../workflow/state-store.js';
import type {
  ActionExecutionResult,
  ActionPort,
  AnalysisPort,
  AuditEntry,
  AuditPort,
  BlockerAnalysis,
  EvidenceReference,
  FindingSnapshot,
  PlannedAction,
  RuleDefinition,
  SimulationResult,
  WorkflowEventInput,
  WorkflowId,
  WorkflowPort,
  WorkflowStateSnapshot,
} from './contracts.js';

const LAPTOP_RESOLUTION_ACTION_ID = 'resolve-laptop-allocation';

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
    payload: event.payload,
    evidenceId: event.evidenceId,
  };
}

function toSourceEvent(event: WorkflowEventInput): SourceEvent {
  return {
    ...event,
    source: event.source === 'hr' ? 'hr-system' : event.source,
    timestamp: new Date(event.timestamp),
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
    joiningDate: PRIYA_JOINING_DATE.toISOString(),
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
export class HandoffOSRuntime implements WorkflowPort, AnalysisPort, ActionPort, AuditPort {
  private readonly updatedAtByWorkflow = new Map<WorkflowId, Date>();
  private readonly store: WorkflowStateStore;

  constructor() {
    this.store = new InMemoryWorkflowStateStore();
    const seed = applyAnalysis(createSeedState());
    this.store.setState(seed);
    this.updatedAtByWorkflow.set(seed.workflowId, demoNow());

    const seedVendor = applyAnalysis(createVendorSeedState());
    this.store.setState(seedVendor);
    this.updatedAtByWorkflow.set(seedVendor.workflowId, demoNow());
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
    state.auditLog.push({
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
    if (analysis.mainBlocker !== 'laptop-allocation') return [];

    return [{
      id: LAPTOP_RESOLUTION_ACTION_ID,
      title: 'Complete Laptop Allocation',
      owner: state.nodes.find((node) => node.id === analysis.mainBlocker)?.owner ?? 'IT Ops',
      evidenceIds: analysis.findings
        .filter((finding) => finding.affectedNodeIds.includes(analysis.mainBlocker!))
        .flatMap((finding) => finding.evidenceIds)
        .filter((id, index, ids) => ids.indexOf(id) === index),
      expectedImpact: 'Completes the root blocker and releases Identity Access and VPN Setup for execution.',
      requiresApproval: true,
    }];
  }

  async executeAction(
    workflowId: WorkflowId,
    actionId: string,
    approvedBy: string,
  ): Promise<ActionExecutionResult> {
    if (actionId !== LAPTOP_RESOLUTION_ACTION_ID) {
      throw new Error(`Action "${actionId}" is not executable for this workflow.`);
    }

    const state = requireState(this.store, workflowId);
    const laptop = state.nodes.find((node) => node.id === 'laptop-allocation');
    if (!laptop) throw new Error('Laptop Allocation node is missing from the workflow.');

    const beforeHealth = analyzeWorkflow(state).health;
    const completedAt = demoNow();
    laptop.status = 'completed';
    laptop.completedAt = completedAt;
    propagateReadyStatuses(state);

    const recalculated = applyAnalysis(state);
    const auditEntry: DomainAuditEntry = {
      id: `AUD-${recalculated.auditLog.length + 1}`,
      timestamp: completedAt,
      action: 'Laptop Allocation completed',
      actor: approvedBy,
      details: {
        summary: `Approved action completed Laptop Allocation and recalculated workflow health from ${beforeHealth} to ${recalculated.health}.`,
        actionId,
        nodeId: laptop.id,
        beforeHealth,
        afterHealth: recalculated.health,
      },
    };
    recalculated.auditLog.push(auditEntry);
    this.commit(recalculated, completedAt);

    return {
      workflowId,
      actionId,
      approvedBy,
      summary: `Laptop Allocation completed. Workflow health changed from ${beforeHealth} to ${recalculated.health}.`,
      state: await this.getState(workflowId),
      auditEntry: toAuditEntry(auditEntry),
    };
  }

  async getAuditLog(workflowId: WorkflowId): Promise<AuditEntry[]> {
    return requireState(this.store, workflowId).auditLog.map(toAuditEntry);
  }

  private commit(state: WorkflowState, updatedAt: Date): void {
    this.store.setState(applyAnalysis(state));
    this.updatedAtByWorkflow.set(state.workflowId, new Date(updatedAt));
  }

  private updatedAt(workflowId: WorkflowId): Date {
    return this.updatedAtByWorkflow.get(workflowId) ?? demoNow();
  }
}
