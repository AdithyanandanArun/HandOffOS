export type NodeStatus = 'completed' | 'blocked' | 'pending' | 'ready' | 'in_progress';

export interface WorkflowNode {
  id: string;
  label: string;
  owner: string;
  status: NodeStatus;
  dependencies: string[];
  sla?: Date;
  ownerResponseSlaHours?: number;
  completedAt?: Date;
  evidenceIds: string[];
}

export interface SourceEvent {
  id: string;
  source: 'gmail' | 'hr-system' | 'task-board' | 'calendar';
  timestamp: Date;
  actor: string;
  type: string;
  payload: Record<string, unknown>;
  evidenceId: string;
  nodeId?: string;
  logicalTaskKey?: string;
  reportedStatus?: NodeStatus;
}

export interface Evidence {
  id: string;
  sourceEventId: string | null;
  type: 'event' | 'absence';
  description: string;
  timestamp: Date;
}

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  explanation: string;
  evidenceIds: string[];
  affectedNodeIds: string[];
  riskPoints: number;
  confidence?: 'strong' | 'weak';
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  previousHash?: string | null;
  hash?: string;
}

export interface ActionPlan {
  id: string;
  nodeId: string;
  action: string;
  requiredApprover: string;
  estimatedCompletion: Date;
}

export interface SimulationResult {
  beforeHealth: number;
  afterHealth: number;
  completionEstimate: Date;
  criticalPath: string[];
  findingsDelta: {
    resolved: Finding[];
    introduced: Finding[];
  };
  beforeFindings: Finding[];
  afterFindings: Finding[];
}

export interface WorkflowState {
  workflowId: string;
  label: string;
  subject: string;
  targetDate: Date;
  nodes: WorkflowNode[];
  events: SourceEvent[];
  evidence: Evidence[];
  findings: Finding[];
  rootBlocker: string | null;
  criticalPath: string[];
  health: number;
  estimatedCompletion: Date | null;
  auditLog: AuditEntry[];
}

export interface OwnerWorkload {
  ownerId: string;
  openNodeIds: string[];
  activeFindingIds: string[];
}

export interface AlertSubscription {
  id: string;
  workflowId: string;
  metric: 'health' | 'sla_overdue' | 'blocked_nodes';
  comparator: 'lt' | 'lte' | 'gt' | 'gte';
  threshold: number;
  subscriberId: string;
  createdAt: Date;
}
