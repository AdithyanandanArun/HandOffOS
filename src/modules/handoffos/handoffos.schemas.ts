import { z } from '@nitrostack/core';

export const workflowIdSchema = z.object({
  workflowId: z.string().min(1).default('onboard-priya'),
});

const principalIdSchema = z.object({
  principalId: z.string().min(1),
});

const protectedWorkflowSchema = workflowIdSchema.merge(principalIdSchema);

export const ingestEventSchema = protectedWorkflowSchema.extend({
  event: z.object({
    id: z.string().min(1),
    source: z.enum(['gmail', 'hr', 'task-board', 'calendar']),
    type: z.string().min(1),
    timestamp: z.string().datetime(),
    actor: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
    evidenceId: z.string().min(1),
  }),
});

export const simulateResolutionSchema = protectedWorkflowSchema.extend({
  nodeId: z.string().min(1),
  resolvedAt: z.string().datetime(),
});

export const executeActionSchema = protectedWorkflowSchema.extend({
  actionId: z.string().min(1),
});

export const detectBlockersSchema = protectedWorkflowSchema;

export const planNextActionsSchema = protectedWorkflowSchema;

export const escalateBlockerSchema = protectedWorkflowSchema;

export const predictCompletionSchema = protectedWorkflowSchema;

export const compareWorkflowsSchema = principalIdSchema.extend({
  workflowIds: z.array(z.string().min(1)).min(1).optional(),
});

export const rollbackActionSchema = protectedWorkflowSchema;

export const simulateMultiResolutionSchema = protectedWorkflowSchema.extend({
  nodeIds: z.array(z.string().min(1)).min(1),
  resolvedAt: z.string().datetime(),
});

export const getOwnerWorkloadSchema = principalIdSchema.extend({
  ownerId: z.string().min(1),
  workflowIds: z.array(z.string().min(1)).min(1).optional(),
});

export const subscribeAlertsSchema = protectedWorkflowSchema.extend({
  metric: z.enum(['health', 'sla_overdue', 'blocked_nodes']),
  comparator: z.enum(['lt', 'lte', 'gt', 'gte']),
  threshold: z.number().finite(),
  subscriberId: z.string().min(1),
});

export const exportAuditReportSchema = protectedWorkflowSchema;

export const verifyAuditIntegritySchema = protectedWorkflowSchema;

export const resetDemoSchema = principalIdSchema;

const nodeStatusSchema = z.enum(['completed', 'blocked', 'pending', 'ready', 'in_progress']);
const severitySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const workflowStateOutputSchema = z.object({
  workflowId: z.string(),
  employee: z.string(),
  joiningDate: z.string().datetime(),
  status: z.enum(['healthy', 'at_risk', 'blocked']),
  healthScore: z.number(),
  mainBlocker: z.string().optional(),
  estimatedCompletion: z.string().datetime(),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    owner: z.string().nullable(),
    status: nodeStatusSchema,
    dependsOn: z.array(z.string()),
    slaHours: z.number(),
    completedAt: z.string().datetime().optional(),
  })),
  updatedAt: z.string().datetime(),
  targetDate: z.string().datetime().optional(),
});

export const findingOutputSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  severity: severitySchema,
  title: z.string(),
  explanation: z.string(),
  evidenceIds: z.array(z.string()),
  affectedNodeIds: z.array(z.string()),
  riskPoints: z.number(),
  confidence: z.enum(['strong', 'weak']),
});

const dashboardDataOutputSchema = z.object({
  workflow: z.object({
    workflowId: z.string(),
    subject: z.string(),
    health: z.number(),
    estimatedCompletion: z.string().datetime(),
    criticalPath: z.array(z.string()),
    stations: z.array(z.object({
      id: z.string(),
      label: z.string(),
      owner: z.string(),
      status: nodeStatusSchema,
      eta: z.string().optional(),
      healthNote: z.string().optional(),
    })),
  }),
  liveTool: z.string(),
  authorization: z.object({
    principalId: z.string(),
    displayName: z.string(),
    roles: z.array(z.string()),
    capability: z.string(),
  }).optional(),
  mainBlocker: z.object({
    stationId: z.string(),
    title: z.string(),
    risk: z.enum(['high', 'medium', 'low']),
    status: nodeStatusSchema,
    eta: z.string(),
    healthImpact: z.number(),
    summary: z.string(),
  }),
  findings: z.array(z.object({
    ruleId: z.string(),
    severity: z.enum(['high', 'medium', 'low']),
    title: z.string(),
    affectedNodes: z.array(z.string()),
    evidenceIds: z.array(z.string()),
    riskPoints: z.number(),
    confidence: z.enum(['strong', 'weak']),
  })),
  evidence: z.array(z.object({
    id: z.string(),
    title: z.string(),
    source: z.string(),
    summary: z.string(),
    reference: z.string(),
  })),
  simulation: z.object({
    before: z.object({ health: z.number(), estimatedCompletion: z.string().datetime(), criticalPath: z.array(z.string()) }),
    after: z.object({ health: z.number(), estimatedCompletion: z.string().datetime(), criticalPath: z.array(z.string()) }),
    resolvedRuleIds: z.array(z.string()),
    introducedRuleIds: z.array(z.string()),
  }),
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    tool: z.enum(['plan_next_actions', 'simulate_resolution', 'execute_action']),
    input: z.record(z.string(), z.unknown()),
    approvalRequired: z.boolean(),
  })),
  auditLog: z.array(z.object({ id: z.string(), at: z.string().datetime(), actor: z.string(), action: z.string(), detail: z.string() })),
});

const analysisOutputSchema = z.object({
  workflowId: z.string(),
  findings: z.array(findingOutputSchema),
  evidence: z.array(z.object({ id: z.string(), summary: z.string() })),
  healthScore: z.number(),
  healthBreakdown: z.array(z.object({ label: z.string(), riskPoints: z.number() })),
  mainBlocker: z.string().optional(),
  criticalPath: z.array(z.string()),
  estimatedCompletion: z.string().datetime(),
});

const actionOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  owner: z.string(),
  evidenceIds: z.array(z.string()),
  expectedImpact: z.string(),
  requiresApproval: z.boolean(),
});

const completionForecastOutputSchema = z.object({
  workflowId: z.string(),
  estimatedCompletion: z.string().datetime(),
  criticalPath: z.array(z.string()),
  delayDrivers: z.array(z.object({
    nodeId: z.string(),
    reasons: z.array(z.string()),
    sla: z.string().datetime().optional(),
  })),
});

const escalationOutputSchema = z.object({
  workflowId: z.string(),
  nodeId: z.string(),
  nodeLabel: z.string(),
  owningTeam: z.string(),
  slaDeadline: z.string().datetime().optional(),
  breachHours: z.number(),
  evidenceIds: z.array(z.string()),
  findingIds: z.array(z.string()),
  summary: z.string(),
});

const workflowComparisonOutputSchema = z.object({
  workflowId: z.string(),
  subject: z.string(),
  healthScore: z.number(),
  mainBlocker: z.string().optional(),
  estimatedCompletion: z.string().datetime(),
  criticalPath: z.array(z.string()),
});

const multiSimulationOutputSchema = z.object({
  workflowId: z.string(),
  resolvedNodeIds: z.array(z.string()),
  before: analysisOutputSchema,
  after: analysisOutputSchema,
  resolvedFindingIds: z.array(z.string()),
  introducedFindingIds: z.array(z.string()),
});

const rollbackOutputSchema = z.object({
  workflowId: z.string(),
  principalId: z.string(),
  summary: z.string(),
  state: workflowStateOutputSchema,
  auditEntry: z.object({
    id: z.string(),
    timestamp: z.string().datetime(),
    action: z.string(),
    actor: z.string(),
    details: z.string(),
    previousHash: z.string().nullable().optional(),
    hash: z.string().optional(),
  }),
});

const ownerWorkloadOutputSchema = z.object({
  ownerId: z.string(),
  openNodeIds: z.array(z.string()),
  activeFindingIds: z.array(z.string()),
});

const alertSubscriptionOutputSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  metric: z.enum(['health', 'sla_overdue', 'blocked_nodes']),
  comparator: z.enum(['lt', 'lte', 'gt', 'gte']),
  threshold: z.number(),
  subscriberId: z.string(),
  createdAt: z.string().datetime(),
});

const auditIntegrityOutputSchema = z.object({
  workflowId: z.string(),
  valid: z.boolean(),
  checkedEntries: z.number().int().nonnegative(),
  latestHash: z.string().optional(),
  firstInvalidEntryId: z.string().optional(),
  reason: z.enum(['missing_hash', 'previous_hash_mismatch', 'entry_hash_mismatch']).optional(),
});

export const ingestEventOutputSchema = z.object({
  summary: z.string(),
  state: workflowStateOutputSchema,
});

export const detectBlockersOutputSchema = z.object({
  summary: z.string(),
  analysis: analysisOutputSchema,
}).merge(dashboardDataOutputSchema);

export const simulateResolutionOutputSchema = z.object({
  summary: z.string(),
  simulationResult: z.object({
    workflowId: z.string(),
    before: analysisOutputSchema,
    after: analysisOutputSchema,
    resolvedFindingIds: z.array(z.string()),
    introducedFindingIds: z.array(z.string()),
  }),
}).merge(dashboardDataOutputSchema);

export const planNextActionsOutputSchema = z.object({
  summary: z.string(),
  actions: z.array(actionOutputSchema),
});

export const executeActionOutputSchema = z.object({
  summary: z.string(),
  execution: z.object({
    workflowId: z.string(),
    actionId: z.string(),
    principalId: z.string(),
    summary: z.string(),
    state: workflowStateOutputSchema,
    auditEntry: z.object({
      id: z.string(),
      timestamp: z.string().datetime(),
      action: z.string(),
      actor: z.string(),
      details: z.string(),
      previousHash: z.string().nullable().optional(),
      hash: z.string().optional(),
    }),
  }),
}).merge(dashboardDataOutputSchema);

export const escalateBlockerOutputSchema = z.object({
  summary: z.string(),
  escalation: escalationOutputSchema,
}).merge(dashboardDataOutputSchema);

export const predictCompletionOutputSchema = z.object({
  summary: z.string(),
  forecast: completionForecastOutputSchema,
}).merge(dashboardDataOutputSchema);

export const compareWorkflowsOutputSchema = z.object({
  summary: z.string(),
  comparisons: z.array(workflowComparisonOutputSchema),
}).merge(dashboardDataOutputSchema);

export const rollbackActionOutputSchema = z.object({
  summary: z.string(),
  rollback: rollbackOutputSchema,
}).merge(dashboardDataOutputSchema);

export const simulateMultiResolutionOutputSchema = z.object({
  summary: z.string(),
  multiSimulation: multiSimulationOutputSchema,
}).merge(dashboardDataOutputSchema);

export const getOwnerWorkloadOutputSchema = z.object({
  summary: z.string(),
  workload: ownerWorkloadOutputSchema,
}).merge(dashboardDataOutputSchema);

export const subscribeAlertsOutputSchema = z.object({
  summary: z.string(),
  subscription: alertSubscriptionOutputSchema,
});

export const exportAuditReportOutputSchema = z.object({
  summary: z.string(),
  report: z.object({
    workflowId: z.string(),
    generatedAt: z.string().datetime(),
    state: workflowStateOutputSchema,
    findings: z.array(findingOutputSchema),
    auditLog: z.array(z.object({
      id: z.string(),
      timestamp: z.string().datetime(),
      action: z.string(),
      actor: z.string(),
      details: z.string(),
      previousHash: z.string().nullable().optional(),
      hash: z.string().optional(),
    })),
    integrity: auditIntegrityOutputSchema,
    markdown: z.string(),
  }),
});

export const verifyAuditIntegrityOutputSchema = z.object({
  summary: z.string(),
  integrity: auditIntegrityOutputSchema,
});

export const resetDemoOutputSchema = z.object({
  summary: z.string(),
  reset: z.object({
    workflowIds: z.array(z.string()),
    resetAt: z.string().datetime(),
    states: z.array(workflowStateOutputSchema),
  }),
});

export type WorkflowIdInput = z.infer<typeof workflowIdSchema>;
export type ProtectedWorkflowInput = z.infer<typeof protectedWorkflowSchema>;
export type IngestEventInput = z.infer<typeof ingestEventSchema>;
export type DetectBlockersInput = z.infer<typeof detectBlockersSchema>;
export type PlanNextActionsInput = z.infer<typeof planNextActionsSchema>;
export type SimulateResolutionInput = z.infer<typeof simulateResolutionSchema>;
export type ExecuteActionInput = z.infer<typeof executeActionSchema>;
export type EscalateBlockerInput = z.infer<typeof escalateBlockerSchema>;
export type PredictCompletionInput = z.infer<typeof predictCompletionSchema>;
export type CompareWorkflowsInput = z.infer<typeof compareWorkflowsSchema>;
export type RollbackActionInput = z.infer<typeof rollbackActionSchema>;
export type SimulateMultiResolutionInput = z.infer<typeof simulateMultiResolutionSchema>;
export type GetOwnerWorkloadInput = z.infer<typeof getOwnerWorkloadSchema>;
export type SubscribeAlertsInput = z.infer<typeof subscribeAlertsSchema>;
export type ExportAuditReportInput = z.infer<typeof exportAuditReportSchema>;
export type VerifyAuditIntegrityInput = z.infer<typeof verifyAuditIntegritySchema>;
export type ResetDemoInput = z.infer<typeof resetDemoSchema>;
