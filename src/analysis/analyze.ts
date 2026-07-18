import type { WorkflowState, Finding } from '../domain/types.js';
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

export interface CompletionForecast {
  estimatedCompletion: Date | null;
  criticalPath: string[];
  delayDrivers: Array<{ nodeId: string; reasons: string[]; sla: Date | null }>;
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
  const analysis = analyzeWorkflow(state);
  const delayDrivers = analysis.criticalPath
    .map((nodeId) => {
      const node = state.nodes.find((candidate) => candidate.id === nodeId);
      if (!node || node.status === 'completed') return undefined;
      const reasons = analysis.findings
        .filter((finding) => finding.affectedNodeIds.includes(nodeId))
        .map((finding) => `${finding.ruleId}: ${finding.title}`);
      return { nodeId, reasons, sla: node.sla ?? null };
    })
    .filter((driver): driver is NonNullable<typeof driver> => Boolean(driver));

  return {
    estimatedCompletion: analysis.estimatedCompletion,
    criticalPath: analysis.criticalPath,
    delayDrivers,
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
