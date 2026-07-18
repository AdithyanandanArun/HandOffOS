import type { WorkflowState, WorkflowNode, Finding } from '../domain/types.js';
import { demoNow } from '../domain/demo-clock.js';

export interface RuleDefinition {
  id: string;
  title: string;
  description: string;
  evaluate: (state: WorkflowState) => Finding[];
}

// Health risk is intentionally de-duplicated across overlapping rules. The seed
// produces 38 points (health 62); resolving Laptop Allocation removes 24 points
// and leaves the Orientation SLA/calendar risk at 14 points (health 86).
export const RISK_POINTS = {
  missingOwner: 5,
  missingDependency: 10,
  slaOverdue: 9,
  missingDocument: 5,
  criticalPathBlocked: 5,
  approvalStale: 0,
  calendarMissing: 5,
  duplicateTask: 5,
  ownerUnresponsive: 8,
  conflictingStatus: 10,
} as const;

function findingId(ruleId: string, nodeId: string): string {
  return `${ruleId}::${nodeId}`;
}

function classifyConfidence(state: WorkflowState, evidenceIds: string[]): 'strong' | 'weak' {
  if (evidenceIds.length < 2) return 'weak';
  const hasAbsence = evidenceIds.some(eid => {
    const ev = state.evidence.find(e => e.id === eid);
    return ev && ev.type === 'absence';
  });
  if (hasAbsence && evidenceIds.length < 3) return 'weak';
  return 'strong';
}

function nodeById(state: WorkflowState, id: string): WorkflowNode | undefined {
  return state.nodes.find(n => n.id === id);
}

// R-001: Missing Owner
const R001: RuleDefinition = {
  id: 'R-001',
  title: 'Missing Owner',
  description: 'A workflow node has no assigned owner.',
  evaluate(state) {
    const findings: Finding[] = [];
    for (const node of state.nodes) {
      if (node.status === 'completed') continue;
      if (!node.owner || node.owner.trim() === '') {
        const eIds = [...node.evidenceIds];
        findings.push({
          id: findingId('R-001', node.id),
          ruleId: 'R-001',
          title: `Missing Owner: ${node.label}`,
          severity: 'high',
          explanation: `Node "${node.label}" has no assigned owner. Work cannot proceed without accountability.`,
          evidenceIds: eIds,
          affectedNodeIds: [node.id],
          riskPoints: RISK_POINTS.missingOwner,
          confidence: classifyConfidence(state, eIds),
        });
      }
    }
    return findings;
  },
};

// R-002: Missing Dependency — fires when a node is blocked despite all
// in-graph dependencies being completed, indicating an external dependency
// (work order, provisioning request, etc.) was never fulfilled.
const R002: RuleDefinition = {
  id: 'R-002',
  title: 'Missing Dependency',
  description: 'A node is blocked because an external dependency was not fulfilled.',
  evaluate(state) {
    const findings: Finding[] = [];
    for (const node of state.nodes) {
      if (node.status !== 'blocked') continue;

      const allGraphDepsComplete = node.dependencies.every(depId => {
        const dep = nodeById(state, depId);
        return dep && dep.status === 'completed';
      });

      if (allGraphDepsComplete) {
        const absenceEvidence = state.evidence.filter(
          e => e.type === 'absence' && node.evidenceIds.includes(e.id)
        );
        const evidenceIds = [...node.evidenceIds];

        findings.push({
          id: findingId('R-002', node.id),
          ruleId: 'R-002',
          title: `Missing Dependency: ${node.label}`,
          severity: 'critical',
          explanation: `Node "${node.label}" is blocked despite all workflow dependencies being completed. An external dependency (${absenceEvidence.length > 0 ? absenceEvidence[0].description : 'unknown'}) was not fulfilled.`,
          evidenceIds,
          affectedNodeIds: [node.id, ...getDownstreamNodes(state, node.id)],
          riskPoints: RISK_POINTS.missingDependency,
          confidence: classifyConfidence(state, evidenceIds),
        });
      }
    }
    return findings;
  },
};

// R-003: SLA Overdue
const R003: RuleDefinition = {
  id: 'R-003',
  title: 'SLA Overdue',
  description: 'A node has exceeded its SLA deadline.',
  evaluate(state) {
    const findings: Finding[] = [];
    const now = demoNow();
    for (const node of state.nodes) {
      if (node.status === 'completed') continue;
      if (node.sla && node.sla.getTime() < now.getTime()) {
        const hrsOverdue = Math.floor((now.getTime() - node.sla.getTime()) / (1000 * 60 * 60));

        const slaEIds = [...node.evidenceIds];
        findings.push({
          id: findingId('R-003', node.id),
          ruleId: 'R-003',
          title: `SLA Overdue: ${node.label}`,
          severity: hrsOverdue > 48 ? 'critical' : 'high',
          explanation: `Node "${node.label}" SLA expired ${hrsOverdue} hours ago (deadline: ${node.sla.toISOString()}).`,
          evidenceIds: slaEIds,
          affectedNodeIds: [node.id],
          riskPoints: RISK_POINTS.slaOverdue,
          confidence: classifyConfidence(state, slaEIds),
        });
      }
    }
    return findings;
  },
};

// R-004: Missing Document — fires when a node explicitly requires a document
// that has not been provided.
const R004: RuleDefinition = {
  id: 'R-004',
  title: 'Missing Document',
  description: 'Expected documentation is missing for a workflow step.',
  evaluate(state) {
    const findings: Finding[] = [];
    for (const node of state.nodes) {
      if (node.status === 'completed') continue;
      const docAbsence = state.evidence.find(
        e =>
          e.type === 'absence' &&
          node.evidenceIds.includes(e.id) &&
          (e.description.toLowerCase().includes('document') ||
           e.description.toLowerCase().includes('checklist') ||
           e.description.toLowerCase().includes('form'))
      );
      if (docAbsence) {
        findings.push({
          id: findingId('R-004', node.id),
          ruleId: 'R-004',
          title: `Missing Document: ${node.label}`,
          severity: 'medium',
          explanation: `Node "${node.label}" is missing required documentation: ${docAbsence.description}`,
          evidenceIds: [docAbsence.id],
          affectedNodeIds: [node.id],
          riskPoints: RISK_POINTS.missingDocument,
          confidence: classifyConfidence(state, [docAbsence.id]),
        });
      }
    }
    return findings;
  },
};

// R-005: Critical Path Blocked
const R005: RuleDefinition = {
  id: 'R-005',
  title: 'Critical Path Blocked',
  description: 'The critical path through the workflow is blocked.',
  evaluate(state) {
    const criticalPath = computeCriticalPath(state);
    const findings: Finding[] = [];

    for (const nodeId of criticalPath) {
      const node = nodeById(state, nodeId);
      if (node && node.status === 'blocked') {
        const cpEIds = [...node.evidenceIds];
        findings.push({
          id: findingId('R-005', node.id),
          ruleId: 'R-005',
          title: `Critical Path Blocked: ${node.label}`,
          severity: 'critical',
          explanation: `Node "${node.label}" is on the critical path and is blocked. All downstream work is stalled.`,
          evidenceIds: cpEIds,
          affectedNodeIds: [node.id, ...getDownstreamNodes(state, node.id)],
          riskPoints: RISK_POINTS.criticalPathBlocked,
          confidence: classifyConfidence(state, cpEIds),
        });
        break;
      }
    }
    return findings;
  },
};

// R-006: Approval Stale
const R006: RuleDefinition = {
  id: 'R-006',
  title: 'Approval Stale',
  description: 'An approval was granted but downstream work has not progressed.',
  evaluate(state) {
    const findings: Finding[] = [];
    const now = demoNow();
    const STALE_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000;

    const approvalEvents = state.events.filter(e => e.type === 'approval_granted');
    for (const evt of approvalEvents) {
      const age = now.getTime() - evt.timestamp.getTime();
      if (age > STALE_THRESHOLD_MS) {
        const hasBlockedDownstream = state.nodes.some(
          n => n.status === 'blocked' || n.status === 'pending'
        );
        if (hasBlockedDownstream) {
          const evidence = state.evidence.find(e => e.sourceEventId === evt.id);
          const staleEIds = evidence ? [evidence.id] : [];
          findings.push({
            id: findingId('R-006', evt.id),
            ruleId: 'R-006',
            title: `Approval Stale: ${evt.actor}`,
            severity: 'medium',
            explanation: `Approval from "${evt.actor}" on ${evt.timestamp.toISOString().split('T')[0]} has not resulted in downstream progress after ${Math.floor(age / (24 * 60 * 60 * 1000))} days.`,
            evidenceIds: staleEIds,
            affectedNodeIds: state.nodes.filter(n => n.status === 'blocked').map(n => n.id),
            riskPoints: RISK_POINTS.approvalStale,
            confidence: classifyConfidence(state, staleEIds),
          });
        }
      }
    }
    return findings;
  },
};

// R-007: Calendar Missing
const R007: RuleDefinition = {
  id: 'R-007',
  title: 'Calendar Missing',
  description: 'A node that typically requires a calendar event has none scheduled.',
  evaluate(state) {
    const findings: Finding[] = [];
    const calendarNodes = ['orientation'];

    for (const nodeId of calendarNodes) {
      const node = nodeById(state, nodeId);
      if (!node || node.status === 'completed') continue;

      const hasCalendarEvent = state.events.some(
        e => e.source === 'calendar' && JSON.stringify(e.payload).toLowerCase().includes(nodeId)
      );

      if (!hasCalendarEvent) {
        const absence = state.evidence.find(
          e => e.type === 'absence' && e.description.toLowerCase().includes('calendar')
        );
        const calEIds = absence ? [absence.id] : [];
        findings.push({
          id: findingId('R-007', node.id),
          ruleId: 'R-007',
          title: `Calendar Missing: ${node.label}`,
          severity: 'medium',
          explanation: `Node "${node.label}" requires a calendar event but none has been scheduled.`,
          evidenceIds: calEIds,
          affectedNodeIds: [node.id],
          riskPoints: RISK_POINTS.calendarMissing,
          confidence: classifyConfidence(state, calEIds),
        });
      }
    }
    return findings;
  },
};

// R-008: Duplicate Task Detected — fires when two independent source events
// attempt to create/register the same logical task node.
const R008: RuleDefinition = {
  id: 'R-008',
  title: 'Duplicate Task Detected',
  description: 'Two independent source events attempt to create the same logical task node.',
  evaluate(state) {
    const findings: Finding[] = [];
    const creationEvents = state.events.filter(
      e => e.type === 'task_created' || e.type === 'task_registered'
    );

    const byTarget = new Map<string, typeof creationEvents>();
    for (const evt of creationEvents) {
      const target = (evt.payload.taskNodeId ?? evt.payload.nodeId ?? '') as string;
      if (!target) continue;
      const group = byTarget.get(target) ?? [];
      group.push(evt);
      byTarget.set(target, group);
    }

    for (const [target, events] of byTarget) {
      if (events.length < 2) continue;
      const eIds = events.map(e => e.evidenceId);
      findings.push({
        id: findingId('R-008', target),
        ruleId: 'R-008',
        title: `Duplicate Task: ${target}`,
        severity: 'high',
        explanation: `${events.length} independent events attempted to create task "${target}". Sources: ${events.map(e => e.source).join(', ')}.`,
        evidenceIds: eIds,
        affectedNodeIds: [target],
        riskPoints: RISK_POINTS.duplicateTask,
        confidence: classifyConfidence(state, eIds),
      });
    }
    return findings;
  },
};

// R-009: Owner Unresponsive — fires when no activity or update event from an
// assigned owner occurs within a configured SLA window.
const R009: RuleDefinition = {
  id: 'R-009',
  title: 'Owner Unresponsive',
  description: 'No activity from assigned owner within the SLA window.',
  evaluate(state) {
    const findings: Finding[] = [];
    const now = demoNow();
    const UNRESPONSIVE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

    for (const node of state.nodes) {
      if (node.status === 'completed' || !node.owner) continue;
      if (node.status === 'blocked' || node.status === 'pending') continue;

      const ownerEvents = state.events.filter(
        e => e.actor === node.owner && now.getTime() - e.timestamp.getTime() < UNRESPONSIVE_THRESHOLD_MS
      );

      if (ownerEvents.length === 0 && node.sla) {
        const eIds = [...node.evidenceIds];
        findings.push({
          id: findingId('R-009', node.id),
          ruleId: 'R-009',
          title: `Owner Unresponsive: ${node.owner} on ${node.label}`,
          severity: 'high',
          explanation: `No activity from owner "${node.owner}" for node "${node.label}" within the last ${UNRESPONSIVE_THRESHOLD_MS / (24 * 60 * 60 * 1000)} days. SLA deadline: ${node.sla.toISOString()}.`,
          evidenceIds: eIds,
          affectedNodeIds: [node.id],
          riskPoints: RISK_POINTS.ownerUnresponsive,
          confidence: classifyConfidence(state, eIds),
        });
      }
    }
    return findings;
  },
};

// R-010: Conflicting Status — fires when two source systems report different
// statuses for the same task node.
const R010: RuleDefinition = {
  id: 'R-010',
  title: 'Conflicting Status',
  description: 'Two source systems report different statuses for the same task node.',
  evaluate(state) {
    const findings: Finding[] = [];
    const statusEvents = state.events.filter(
      e => e.type === 'status_update' || e.type === 'status_report'
    );

    const byTarget = new Map<string, typeof statusEvents>();
    for (const evt of statusEvents) {
      const target = (evt.payload.taskNodeId ?? evt.payload.nodeId ?? '') as string;
      if (!target) continue;
      const group = byTarget.get(target) ?? [];
      group.push(evt);
      byTarget.set(target, group);
    }

    for (const [target, events] of byTarget) {
      if (events.length < 2) continue;
      const statuses = new Set(events.map(e => e.payload.status as string));
      if (statuses.size < 2) continue;

      const eIds = events.map(e => e.evidenceId);
      findings.push({
        id: findingId('R-010', target),
        ruleId: 'R-010',
        title: `Conflicting Status: ${target}`,
        severity: 'critical',
        explanation: `Task "${target}" has conflicting statuses reported by different systems: ${[...statuses].join(' vs ')}. Sources: ${events.map(e => e.source).join(', ')}.`,
        evidenceIds: eIds,
        affectedNodeIds: [target],
        riskPoints: RISK_POINTS.conflictingStatus,
        confidence: classifyConfidence(state, eIds),
      });
    }
    return findings;
  },
};

export const ALL_RULES: RuleDefinition[] = [R001, R002, R003, R004, R005, R006, R007, R008, R009, R010];

export function evaluateAllRules(state: WorkflowState): Finding[] {
  const findings: Finding[] = [];
  for (const rule of ALL_RULES) {
    findings.push(...rule.evaluate(state));
  }
  return findings;
}

export function computeCriticalPath(state: WorkflowState): string[] {
  function longestPath(nodeId: string, visited: Set<string>): string[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const dependents = state.nodes.filter(n => n.dependencies.includes(nodeId));
    if (dependents.length === 0) {
      visited.delete(nodeId);
      return [nodeId];
    }

    let longest: string[] = [];
    for (const dep of dependents) {
      const path = longestPath(dep.id, visited);
      if (path.length > longest.length) longest = path;
    }

    visited.delete(nodeId);
    return [nodeId, ...longest];
  }

  const roots = state.nodes.filter(n => n.dependencies.length === 0);
  let criticalPath: string[] = [];

  for (const root of roots) {
    const path = longestPath(root.id, new Set());
    if (path.length > criticalPath.length) criticalPath = path;
  }

  return criticalPath;
}

export function findRootBlocker(state: WorkflowState): string | null {
  const criticalPath = computeCriticalPath(state);

  for (const nodeId of criticalPath) {
    const node = nodeById(state, nodeId);
    if (node && node.status === 'blocked') {
      return node.id;
    }
  }

  for (const node of state.nodes) {
    if (node.status === 'blocked') return node.id;
  }

  return null;
}

export function getDownstreamNodes(state: WorkflowState, nodeId: string): string[] {
  const downstream: string[] = [];
  const visited = new Set<string>();

  function traverse(id: string) {
    for (const node of state.nodes) {
      if (node.dependencies.includes(id) && !visited.has(node.id)) {
        visited.add(node.id);
        downstream.push(node.id);
        traverse(node.id);
      }
    }
  }

  traverse(nodeId);
  return downstream;
}
