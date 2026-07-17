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

export type WorkflowIdInput = z.infer<typeof workflowIdSchema>;
export type IngestEventInput = z.infer<typeof ingestEventSchema>;
export type SimulateResolutionInput = z.infer<typeof simulateResolutionSchema>;
export type ExecuteActionInput = z.infer<typeof executeActionSchema>;
