import type { WorkflowState, SimulationResult } from '../domain/types.ts';
import { analyzeWorkflow } from './analyze.ts';

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function rehydrateDates(state: WorkflowState): void {
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
