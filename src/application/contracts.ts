export type WorkflowId = string;

export type WorkflowEventSource = 'gmail' | 'hr' | 'task-board' | 'calendar';

export interface WorkflowEventInput {
  id: string;
  source: WorkflowEventSource;
  type: string;
  timestamp: string;
  actor: string;
  payload: Record<string, unknown>;
  evidenceId: string;
}

export interface WorkflowNodeSnapshot {
  id: string;
  label: string;
  owner: string | null;
  status: 'completed' | 'blocked' | 'pending' | 'ready' | 'in_progress';
  dependsOn: string[];
  slaHours: number;
  completedAt?: string;
}

export interface WorkflowStateSnapshot {
  workflowId: WorkflowId;
  employee: string;
  joiningDate: string;
  status: 'healthy' | 'at_risk' | 'blocked';
  healthScore: number;
  mainBlocker?: string;
  estimatedCompletion: string;
  nodes: WorkflowNodeSnapshot[];
  updatedAt: string;
}

export interface EvidenceReference {
  id: string;
  summary: string;
}

export interface FindingSnapshot {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  explanation: string;
  evidenceIds: string[];
  affectedNodeIds: string[];
  riskPoints: number;
  confidence: 'strong' | 'weak';
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

export interface BlockerAnalysis {
  workflowId: WorkflowId;
  findings: FindingSnapshot[];
  evidence: EvidenceReference[];
  healthScore: number;
  healthBreakdown: Array<{ label: string; riskPoints: number }>;
  mainBlocker?: string;
  criticalPath: string[];
  estimatedCompletion: string;
}

export interface SimulationResult {
  workflowId: WorkflowId;
  before: BlockerAnalysis;
  after: BlockerAnalysis;
  resolvedFindingIds: string[];
  introducedFindingIds: string[];
}

export interface PlannedAction {
  id: string;
  title: string;
  owner: string;
  evidenceIds: string[];
  expectedImpact: string;
  requiresApproval: boolean;
}

export interface ActionExecutionResult {
  workflowId: WorkflowId;
  actionId: string;
  approvedBy: string;
  summary: string;
  state: WorkflowStateSnapshot;
  auditEntry: AuditEntry;
}

export interface WorkflowPort {
  getState(workflowId: WorkflowId): Promise<WorkflowStateSnapshot>;
  getEvents(workflowId: WorkflowId): Promise<WorkflowEventInput[]>;
  ingestEvent(workflowId: WorkflowId, event: WorkflowEventInput): Promise<WorkflowStateSnapshot>;
}

export interface AnalysisPort {
  getFindings(workflowId: WorkflowId): Promise<FindingSnapshot[]>;
  getRules(): Promise<RuleDefinition[]>;
  detectBlockers(workflowId: WorkflowId): Promise<BlockerAnalysis>;
  simulateResolution(
    workflowId: WorkflowId,
    nodeId: string,
    resolvedAt: string,
  ): Promise<SimulationResult>;
}

export interface ActionPort {
  planNextActions(workflowId: WorkflowId): Promise<PlannedAction[]>;
  executeAction(
    workflowId: WorkflowId,
    actionId: string,
    approvedBy: string,
  ): Promise<ActionExecutionResult>;
}

export interface AuditPort {
  getAuditLog(workflowId: WorkflowId): Promise<AuditEntry[]>;
}
