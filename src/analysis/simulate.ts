import type { WorkflowState, SimulationResult } from '../domain/types.js';
import { analyzeWorkflow } from './analyze.js';

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function rehydrateDates(state: WorkflowState): void {
  state.targetDate = new Date(state.targetDate);
  for (const node of state.nodes) {
    if (node.sla) node.sla = new Date(node.sla);
    if (node.completedAt) node.completedAt = new Date(node.completedAt);
  }
  for (const evt of state.events) {
    evt.timestamp = new Date(evt.timestamp);
  }
  for (const evd of state.evidence) {
    evd.timestamp = new Date(evd.timestamp);
  }
  for (const entry of state.auditLog) {
    entry.timestamp = new Date(entry.timestamp);
  }
}

function propagateStatuses(state: WorkflowState): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of state.nodes) {
      if (node.status === 'completed') continue;

      const allDepsComplete = node.dependencies.every(depId => {
        const dep = state.nodes.find(n => n.id === depId);
        return dep && dep.status === 'completed';
      });

      const anyDepBlocked = node.dependencies.some(depId => {
        const dep = state.nodes.find(n => n.id === depId);
        return !dep || dep.status === 'blocked';
      });

      if (anyDepBlocked && node.status !== 'blocked') {
        node.status = 'blocked';
        changed = true;
      } else if (allDepsComplete && (node.status === 'blocked' || node.status === 'pending')) {
        node.status = 'ready';
        changed = true;
      }
    }
  }
}

export function simulateResolution(
  state: WorkflowState,
  nodeId: string,
  resolvedAt: Date
): SimulationResult {
  const beforeAnalysis = analyzeWorkflow(state);

  const cloned = deepClone(state);
  rehydrateDates(cloned);

  const targetNode = cloned.nodes.find(n => n.id === nodeId);
  if (!targetNode) {
    throw new Error(`Node "${nodeId}" not found in workflow`);
  }

  targetNode.status = 'completed';
  targetNode.completedAt = resolvedAt;
  if (!targetNode.owner || targetNode.owner.trim() === '') {
    targetNode.owner = 'IT Ops (simulated)';
  }

  propagateStatuses(cloned);

  const afterAnalysis = analyzeWorkflow(cloned);

  const resolvedFindings = beforeAnalysis.findings.filter(
    bf => !afterAnalysis.findings.some(af => af.id === bf.id)
  );
  const introducedFindings = afterAnalysis.findings.filter(
    af => !beforeAnalysis.findings.some(bf => bf.id === af.id)
  );

  return {
    beforeHealth: beforeAnalysis.health,
    afterHealth: afterAnalysis.health,
    completionEstimate: afterAnalysis.estimatedCompletion ?? resolvedAt,
    criticalPath: afterAnalysis.criticalPath,
    findingsDelta: {
      resolved: resolvedFindings,
      introduced: introducedFindings,
    },
    beforeFindings: beforeAnalysis.findings,
    afterFindings: afterAnalysis.findings,
  };
}

export interface MultiSimulationResult extends SimulationResult {
  resolvedNodeIds: string[];
}

export function simulateMultiResolution(
  state: WorkflowState,
  nodeIds: string[],
  resolvedAt: Date,
): MultiSimulationResult {
  const uniqueNodeIds = [...new Set(nodeIds)];
  if (!uniqueNodeIds.length) throw new Error('At least one node must be selected for simulation.');
  const beforeAnalysis = analyzeWorkflow(state);
  const cloned = deepClone(state);
  rehydrateDates(cloned);

  for (const nodeId of uniqueNodeIds) {
    const target = cloned.nodes.find((node) => node.id === nodeId);
    if (!target) throw new Error(`Node "${nodeId}" not found in workflow`);
    target.status = 'completed';
    target.completedAt = resolvedAt;
  }
  propagateStatuses(cloned);
  const afterAnalysis = analyzeWorkflow(cloned);
  const resolved = beforeAnalysis.findings.filter((finding) => !afterAnalysis.findings.some((next) => next.id === finding.id));
  const introduced = afterAnalysis.findings.filter((finding) => !beforeAnalysis.findings.some((previous) => previous.id === finding.id));

  return {
    resolvedNodeIds: uniqueNodeIds,
    beforeHealth: beforeAnalysis.health,
    afterHealth: afterAnalysis.health,
    completionEstimate: afterAnalysis.estimatedCompletion ?? resolvedAt,
    criticalPath: afterAnalysis.criticalPath,
    findingsDelta: { resolved, introduced },
    beforeFindings: beforeAnalysis.findings,
    afterFindings: afterAnalysis.findings,
  };
}
