import { ExecutionContext, PromptDecorator as Prompt } from '@nitrostack/core';

export class HandoffOSPrompts {
  @Prompt({
    name: 'explain_blocker',
    description: 'Explain a blocker using only findings and evidence supplied by HandoffOS resources.',
    arguments: [
      { name: 'workflowId', description: 'Workflow identifier.', required: false },
      { name: 'findingId', description: 'Optional finding identifier to explain.', required: false },
    ],
  })
  async explainBlocker(
    arguments_: { workflowId?: string; findingId?: string },
    context: ExecutionContext,
  ) {
    context.logger.info('Generating evidence-grounded blocker explanation', arguments_);
    const workflowId = arguments_.workflowId ?? 'onboard-priya';
    const findingClause = arguments_.findingId ? ` Focus on finding ${arguments_.findingId}.` : '';

    return [{
      role: 'assistant' as const,
      content: `Use workflow://${workflowId}/findings and workflow://${workflowId}/events as the source of truth.${findingClause} Explain only facts supported by those resources. Cite the rule IDs and evidence IDs. Do not invent owners, events, dates, or remediation outcomes.`,
    }];
  }

  @Prompt({
    name: 'manager_summary',
    description: 'Create a concise evidence-grounded manager summary for a workflow.',
    arguments: [
      { name: 'workflowId', description: 'Workflow identifier.', required: false },
    ],
  })
  async managerSummary(arguments_: { workflowId?: string }, context: ExecutionContext) {
    context.logger.info('Generating manager summary prompt', arguments_);
    const workflowId = arguments_.workflowId ?? 'onboard-priya';

    return [{
      role: 'assistant' as const,
      content: `Read workflow://${workflowId}/state, workflow://${workflowId}/findings, and workflow://${workflowId}/audit-log. Summarize the main blocker, owner, business impact, evidence-backed next action, and estimated completion. State uncertainty when evidence is absent and do not invent operational facts.`,
    }];
  }
}
