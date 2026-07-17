import { ExecutionContext, PromptDecorator as Prompt } from '@nitrostack/core';

export class HandoffOSPrompts {
  @Prompt({
    name: 'handoffos_help',
    description: 'Describe the HandoffOS foundation and planned workflow intelligence capabilities.',
  })
  async getHelp(_arguments: Record<string, never>, context: ExecutionContext) {
    context.logger.info('Generating HandoffOS help prompt');

    return [{
      role: 'assistant' as const,
      content: 'HandoffOS is an MCP-native workflow intelligence engine. Phase 1 establishes the NitroStack server, resource, tool, prompt, and widget foundation. Later phases add deterministic workflow state, rules, evidence, simulation, and approved action execution.',
    }];
  }
}
