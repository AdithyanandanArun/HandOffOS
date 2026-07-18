export type NodeStatus = 'completed' | 'blocked' | 'pending' | 'ready' | 'in_progress';

export interface WorkflowNode {
  id: string;
  label: string;
  owner: string;
  status: NodeStatus;
  dependencies: string[];
  sla?: Date;
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
  confidence: 'strong' | 'weak';
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  details: Record<string, unknown>;
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

export interface CompletionForecast {
  estimatedCompletion: Date;
  totalDaysRemaining: number;
  delayDrivers: { nodeId: string; label: string; reason: string; daysContributed: number }[];
  criticalPath: string[];
}

export interface MultiSimulationResult extends SimulationResult {
  resolvedNodeIds: string[];
}

export interface WorkflowState {
  workflowId: string;
  label: string;
  subject: string;
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
