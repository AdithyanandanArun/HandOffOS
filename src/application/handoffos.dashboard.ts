import type {
  ActionExecutionResult,
  AuditEntry,
  BlockerAnalysis,
  PlannedAction,
  SimulationResult,
  WorkflowStateSnapshot,
} from './contracts.js';

type WidgetRisk = 'high' | 'medium' | 'low';

export interface WidgetAction {
  id: string;
  label: string;
  tool: 'plan_next_actions' | 'simulate_resolution' | 'execute_action';
  input: Record<string, unknown>;
  approvalRequired: boolean;
}

export interface HandoffDashboardData {
  workflow: {
    workflowId: string;
    subject: string;
    health: number;
    estimatedCompletion: string;
    criticalPath: string[];
    stations: Array<{
      id: string;
      label: string;
      owner: string;
      status: WorkflowStateSnapshot['nodes'][number]['status'];
      eta?: string;
      healthNote?: string;
    }>;
  };
  liveTool: string;
  mainBlocker: {
    stationId: string;
    title: string;
    risk: WidgetRisk;
    status: WorkflowStateSnapshot['nodes'][number]['status'];
    eta: string;
    healthImpact: number;
    summary: string;
  };
  findings: Array<{
    ruleId: string;
    severity: WidgetRisk;
    title: string;
    affectedNodes: string[];
    evidenceIds: string[];
    riskPoints: number;
    confidence: 'strong' | 'weak';
  }>;
  evidence: Array<{
    id: string;
    title: string;
    source: string;
    summary: string;
    reference: string;
  }>;
  simulation: {
    before: { health: number; estimatedCompletion: string; criticalPath: string[] };
    after: { health: number; estimatedCompletion: string; criticalPath: string[] };
    resolvedRuleIds: string[];
    introducedRuleIds: string[];
  };
  actions: WidgetAction[];
  auditLog: Array<{ id: string; at: string; actor: string; action: string; detail: string }>;
}

function toWidgetRisk(severity: 'low' | 'medium' | 'high' | 'critical'): WidgetRisk {
  return severity === 'critical' ? 'high' : severity;
}

function actionForPlan(workflowId: string): WidgetAction {
  return {
    id: 'plan-next-actions',
    label: 'Plan approved next action',
    tool: 'plan_next_actions',
    input: { workflowId },
    approvalRequired: false,
  };
}

function actionForSimulation(workflowId: string, nodeId: string): WidgetAction {
  return {
    id: `simulate-${nodeId}`,
    label: `Simulate resolving ${nodeId.replaceAll('-', ' ')}`,
    tool: 'simulate_resolution',
    input: { workflowId, nodeId, resolvedAt: '2025-01-15T10:00:00.000Z' },
    approvalRequired: false,
  };
}

function actionsFor(
  workflowId: string,
  mainBlocker: string | undefined,
  plannedActions?: PlannedAction[],
): WidgetAction[] {
  if (plannedActions?.length) {
    return plannedActions.map((action) => ({
      id: action.id,
      label: action.title,
      tool: 'execute_action',
      input: { workflowId, actionId: action.id, approvedBy: '' },
      approvalRequired: action.requiresApproval,
    }));
  }

  const actions = [actionForPlan(workflowId)];
  if (mainBlocker) actions.unshift(actionForSimulation(workflowId, mainBlocker));
  return actions;
}

export function createDashboardData(input: {
  state: WorkflowStateSnapshot;
  analysis: BlockerAnalysis;
  liveTool: string;
  simulation?: SimulationResult;
  plannedActions?: PlannedAction[];
  auditLog?: AuditEntry[];
  execution?: ActionExecutionResult;
}): HandoffDashboardData {
  const { state, analysis } = input;
  const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
  const blocker = analysis.mainBlocker ? nodeById.get(analysis.mainBlocker) : undefined;
  const blockerFindings = blocker
    ? analysis.findings.filter((finding) => finding.affectedNodeIds.includes(blocker.id))
    : [];
  const primaryFinding = blockerFindings[0];
  const healthImpact = blockerFindings.reduce((total, finding) => total + finding.riskPoints, 0);
  const simulation = input.simulation;

  return {
    workflow: {
      workflowId: state.workflowId,
      subject: state.employee,
      health: state.healthScore,
      estimatedCompletion: state.estimatedCompletion,
      criticalPath: analysis.criticalPath,
      stations: state.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        owner: node.owner ?? 'Unassigned',
        status: node.status,
        eta: node.completedAt ?? (node.slaHours ? `${node.slaHours} SLA hours remaining` : undefined),
        healthNote: node.id === analysis.mainBlocker ? 'Root blocker' : undefined,
      })),
    },
    liveTool: input.liveTool,
    mainBlocker: {
      stationId: blocker?.id ?? 'none',
      title: blocker?.label ?? 'No active blocker',
      risk: primaryFinding ? toWidgetRisk(primaryFinding.severity) : 'low',
      status: blocker?.status ?? 'completed',
      eta: blocker?.slaHours ? `${blocker.slaHours} SLA hours remaining` : state.estimatedCompletion,
      healthImpact: -healthImpact,
      summary: primaryFinding?.explanation ?? 'No deterministic blocker is currently active.',
    },
    findings: analysis.findings.map((finding) => ({
      ruleId: finding.ruleId,
      severity: toWidgetRisk(finding.severity),
      title: finding.title,
      affectedNodes: finding.affectedNodeIds.map((id) => nodeById.get(id)?.label ?? id),
      evidenceIds: finding.evidenceIds,
      riskPoints: finding.riskPoints,
      confidence: finding.confidence,
    })),
    evidence: analysis.evidence.map((evidence) => ({
      id: evidence.id,
      title: `Evidence ${evidence.id}`,
      source: 'workflow event store',
      summary: evidence.summary,
      reference: `workflow://${state.workflowId}/events#${evidence.id}`,
    })),
    simulation: {
      before: simulation
        ? { health: simulation.before.healthScore, estimatedCompletion: simulation.before.estimatedCompletion, criticalPath: simulation.before.criticalPath }
        : { health: analysis.healthScore, estimatedCompletion: analysis.estimatedCompletion, criticalPath: analysis.criticalPath },
      after: simulation
        ? { health: simulation.after.healthScore, estimatedCompletion: simulation.after.estimatedCompletion, criticalPath: simulation.after.criticalPath }
        : { health: analysis.healthScore, estimatedCompletion: analysis.estimatedCompletion, criticalPath: analysis.criticalPath },
      resolvedRuleIds: simulation
        ? [...new Set(simulation.resolvedFindingIds.map((id) => id.split('::')[0]))]
        : [],
      introducedRuleIds: simulation
        ? [...new Set(simulation.introducedFindingIds.map((id) => id.split('::')[0]))]
        : [],
    },
    actions: actionsFor(state.workflowId, analysis.mainBlocker, input.plannedActions),
    auditLog: (input.auditLog ?? []).map((entry) => ({
      id: entry.id,
      at: entry.timestamp,
      actor: entry.actor,
      action: entry.action,
      detail: entry.details,
    })),
  };
}
