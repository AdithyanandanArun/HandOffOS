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
  targetDate?: string;
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
  previousHash?: string | null;
  hash?: string;
}

export interface AuditIntegrityResult {
  workflowId: WorkflowId;
  valid: boolean;
  checkedEntries: number;
  latestHash?: string;
  firstInvalidEntryId?: string;
  reason?: 'missing_hash' | 'previous_hash_mismatch' | 'entry_hash_mismatch';
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

export interface CompletionForecast {
  workflowId: WorkflowId;
  estimatedCompletion: string;
  criticalPath: string[];
  delayDrivers: Array<{ nodeId: string; reasons: string[]; sla?: string }>;
}

export interface EscalationPayload {
  workflowId: WorkflowId;
  nodeId: string;
  nodeLabel: string;
  owningTeam: string;
  slaDeadline?: string;
  breachHours: number;
  evidenceIds: string[];
  findingIds: string[];
  summary: string;
}

export interface WorkflowComparison {
  workflowId: WorkflowId;
  subject: string;
  healthScore: number;
  mainBlocker?: string;
  estimatedCompletion: string;
  criticalPath: string[];
}

export interface MultiSimulationResult {
  workflowId: WorkflowId;
  resolvedNodeIds: string[];
  before: BlockerAnalysis;
  after: BlockerAnalysis;
  resolvedFindingIds: string[];
  introducedFindingIds: string[];
}

export interface RollbackActionResult {
  workflowId: WorkflowId;
  approvedBy: string;
  summary: string;
  state: WorkflowStateSnapshot;
  auditEntry: AuditEntry;
}

export interface OwnerWorkloadResult {
  ownerId: string;
  openNodeIds: string[];
  activeFindingIds: string[];
}

export interface AlertSubscriptionResult {
  id: string;
  workflowId: WorkflowId;
  metric: 'health' | 'sla_overdue' | 'blocked_nodes';
  comparator: 'lt' | 'lte' | 'gt' | 'gte';
  threshold: number;
  subscriberId: string;
  createdAt: string;
}

export interface AuditReport {
  workflowId: WorkflowId;
  generatedAt: string;
  state: WorkflowStateSnapshot;
  findings: FindingSnapshot[];
  auditLog: AuditEntry[];
  integrity: AuditIntegrityResult;
  markdown: string;
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
  verifyAuditIntegrity(workflowId: WorkflowId): Promise<AuditIntegrityResult>;
}

export interface Phase2Port {
  escalateBlocker(workflowId: WorkflowId): Promise<EscalationPayload>;
  predictCompletion(workflowId: WorkflowId): Promise<CompletionForecast>;
  compareWorkflows(workflowIds?: WorkflowId[]): Promise<WorkflowComparison[]>;
  rollbackAction(workflowId: WorkflowId, approvedBy: string): Promise<RollbackActionResult>;
  simulateMultiResolution(workflowId: WorkflowId, nodeIds: string[], resolvedAt: string): Promise<MultiSimulationResult>;
  getOwnerWorkload(ownerId: string, workflowIds?: WorkflowId[]): Promise<OwnerWorkloadResult>;
  subscribeAlerts(input: Omit<AlertSubscriptionResult, 'id' | 'createdAt'>): Promise<AlertSubscriptionResult>;
  exportAuditReport(workflowId: WorkflowId): Promise<AuditReport>;
}
