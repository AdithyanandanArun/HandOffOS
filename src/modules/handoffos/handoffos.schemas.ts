import { z } from '@nitrostack/core';

export const workflowIdSchema = z.object({
  workflowId: z.string().min(1).default('onboard-priya'),
});

export const ingestEventSchema = workflowIdSchema.extend({
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

export const simulateResolutionSchema = workflowIdSchema.extend({
  nodeId: z.string().min(1),
  resolvedAt: z.string().datetime(),
});

export const executeActionSchema = workflowIdSchema.extend({
  actionId: z.string().min(1),
  approvedBy: z.string().min(1),
});

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
    approvedBy: z.string(),
    summary: z.string(),
    state: workflowStateOutputSchema,
    auditEntry: z.object({
      id: z.string(),
      timestamp: z.string().datetime(),
      action: z.string(),
      actor: z.string(),
      details: z.string(),
    }),
  }),
}).merge(dashboardDataOutputSchema);

export type WorkflowIdInput = z.infer<typeof workflowIdSchema>;
export type IngestEventInput = z.infer<typeof ingestEventSchema>;
export type SimulateResolutionInput = z.infer<typeof simulateResolutionSchema>;
export type ExecuteActionInput = z.infer<typeof executeActionSchema>;
