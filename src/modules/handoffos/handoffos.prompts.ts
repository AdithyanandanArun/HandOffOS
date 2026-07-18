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

  @Prompt({
    name: 'escalation_email',
    description: 'Draft an escalation email using only the escalation tool output and workflow evidence.',
    arguments: [
      { name: 'workflowId', description: 'Workflow identifier.', required: false },
      { name: 'recipient', description: 'Blocking team or recipient name.', required: false },
    ],
  })
  async escalationEmail(
    arguments_: { workflowId?: string; recipient?: string },
    context: ExecutionContext,
  ) {
    context.logger.info('Generating evidence-grounded escalation email prompt', arguments_);
    const workflowId = arguments_.workflowId ?? 'onboard-priya';
    const recipient = arguments_.recipient ?? 'the responsible team';
    return [{
      role: 'assistant' as const,
      content: `Call escalate_blocker for workflowId "${workflowId}" and read workflow://${workflowId}/findings plus workflow://${workflowId}/events. Draft a concise email to ${recipient}. Include only the returned owning team, SLA deadline or breach duration when present, rule IDs, and evidence IDs. If a field is absent, say it is unavailable. Do not claim an action was executed or promise an outcome.`,
    }];
  }

  @Prompt({
    name: 'executive_digest',
    description: 'Create a one-paragraph leadership digest from deterministic workflow comparisons.',
    arguments: [
      { name: 'workflowIds', description: 'Optional comma-separated workflow identifiers.', required: false },
    ],
  })
  async executiveDigest(arguments_: { workflowIds?: string }, context: ExecutionContext) {
    context.logger.info('Generating executive digest prompt', arguments_);
    const requestedIds = arguments_.workflowIds?.trim();
    const toolInput = requestedIds
      ? ` with workflowIds [${requestedIds.split(',').map((id) => `"${id.trim()}"`).join(', ')}]`
      : '';
    return [{
      role: 'assistant' as const,
      content: `Call compare_workflows${toolInput}. Produce one paragraph for leadership using only each workflow's health score, root blocker, estimated completion, and critical path returned by the tool. Name uncertainty explicitly when a blocker is absent. Do not infer business impact, owners, or dates beyond the returned data.`,
    }];
  }

  @Prompt({
    name: 'root_cause_narrative',
    description: 'Explain a workflow delay by connecting deterministic rules to their recorded evidence.',
    arguments: [
      { name: 'workflowId', description: 'Workflow identifier.', required: false },
      { name: 'findingId', description: 'Optional finding identifier to focus on.', required: false },
    ],
  })
  async rootCauseNarrative(
    arguments_: { workflowId?: string; findingId?: string },
    context: ExecutionContext,
  ) {
    context.logger.info('Generating root cause narrative prompt', arguments_);
    const workflowId = arguments_.workflowId ?? 'onboard-priya';
    const findingScope = arguments_.findingId ? ` Focus on finding ${arguments_.findingId}.` : '';
    return [{
      role: 'assistant' as const,
      content: `Read workflow://${workflowId}/state, workflow://${workflowId}/findings, and workflow://${workflowId}/events.${findingScope} Explain the causal chain only where rule IDs, node dependencies, and evidence IDs support it. Separate direct evidence from the deterministic dependency consequence. Do not speculate about intent, missing events, owners, or remediation success.`,
    }];
  }

  @Prompt({
    name: 'onboarding_readiness_check',
    description: 'Assess onboarding readiness using only the current workflow state and evidence.',
    arguments: [
      { name: 'workflowId', description: 'Workflow identifier.', required: false },
    ],
  })
  async onboardingReadinessCheck(arguments_: { workflowId?: string }, context: ExecutionContext) {
    context.logger.info('Generating onboarding readiness prompt', arguments_);
    const workflowId = arguments_.workflowId ?? 'onboard-priya';
    return [{
      role: 'assistant' as const,
      content: `Read workflow://${workflowId}/state, workflow://${workflowId}/findings, and workflow://${workflowId}/events. Decide whether all required onboarding nodes are completed or ready according to the state resource. Return "not enough evidence" if the required condition or supporting evidence is missing. Cite node IDs, rule IDs, and evidence IDs; do not invent a readiness decision or completion date.`,
    }];
  }
}
