import type { WorkflowState, Finding, CompletionForecast } from '../domain/types.js';
import { demoNow, ESTIMATED_TASK_DURATION_DAYS } from '../domain/demo-clock.js';
import { evaluateAllRules, computeCriticalPath, findRootBlocker } from '../rules/engine.js';

export interface AnalysisResult {
  findings: Finding[];
  rootBlocker: string | null;
  criticalPath: string[];
  health: number;
  healthBreakdown: { ruleId: string; findingId: string; riskPoints: number }[];
  estimatedCompletion: Date | null;
}

export function calculateHealth(findings: Finding[]): { health: number; breakdown: { ruleId: string; findingId: string; riskPoints: number }[] } {
  const breakdown = findings
    .filter(f => f.riskPoints > 0)
    .map(f => ({ ruleId: f.ruleId, findingId: f.id, riskPoints: f.riskPoints }));

  const totalRisk = breakdown.reduce((sum, b) => sum + b.riskPoints, 0);
  const health = Math.max(0, 100 - totalRisk);

  return { health, breakdown };
}

export function estimateCompletion(state: WorkflowState): Date | null {
  const now = demoNow();
  const incomplete = state.nodes.filter(n => n.status !== 'completed');
  if (incomplete.length === 0) return now;

  const criticalPath = computeCriticalPath(state);
  const incompleteOnPath = criticalPath.filter(id => {
    const node = state.nodes.find(n => n.id === id);
    return node && node.status !== 'completed';
  });

  const daysRemaining = incompleteOnPath.length * ESTIMATED_TASK_DURATION_DAYS;
  const estimate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
  return estimate;
}

export function predictCompletion(state: WorkflowState): CompletionForecast {
  const now = demoNow();
  const criticalPath = computeCriticalPath(state);
  const delayDrivers: CompletionForecast['delayDrivers'] = [];

  let totalDaysRemaining = 0;

  for (const nodeId of criticalPath) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || node.status === 'completed') continue;

    let reason: string;
    let daysContributed = ESTIMATED_TASK_DURATION_DAYS;

    if (node.status === 'blocked') {
      const hasSla = node.sla && node.sla.getTime() < now.getTime();
      if (hasSla) {
        const overdueDays = Math.ceil((now.getTime() - node.sla!.getTime()) / (24 * 60 * 60 * 1000));
        daysContributed += overdueDays;
        reason = `Blocked and ${overdueDays} days past SLA`;
      } else {
        reason = 'Blocked by incomplete dependency';
      }
    } else if (node.sla && node.sla.getTime() < now.getTime()) {
      const overdueDays = Math.ceil((now.getTime() - node.sla!.getTime()) / (24 * 60 * 60 * 1000));
      daysContributed += overdueDays;
      reason = `SLA overdue by ${overdueDays} days`;
    } else {
      reason = 'Awaiting completion';
    }

    totalDaysRemaining += daysContributed;
    delayDrivers.push({
      nodeId: node.id,
      label: node.label,
      reason,
      daysContributed,
    });
  }

  const estimatedCompletion = new Date(now.getTime() + totalDaysRemaining * 24 * 60 * 60 * 1000);

  return {
    estimatedCompletion,
    totalDaysRemaining,
    delayDrivers,
    criticalPath,
  };
}

export function analyzeWorkflow(state: WorkflowState): AnalysisResult {
  const findings = evaluateAllRules(state);
  const rootBlocker = findRootBlocker(state);
  const criticalPath = computeCriticalPath(state);
  const { health, breakdown } = calculateHealth(findings);
  const estimatedCompletion = estimateCompletion(state);

  return {
    findings,
    rootBlocker,
    criticalPath,
    health,
    healthBreakdown: breakdown,
    estimatedCompletion,
  };
}

export function applyAnalysis(state: WorkflowState): WorkflowState {
  const result = analyzeWorkflow(state);
  return {
    ...state,
    findings: result.findings,
    rootBlocker: result.rootBlocker,
    criticalPath: result.criticalPath,
    health: result.health,
    estimatedCompletion: result.estimatedCompletion,
  };
}
