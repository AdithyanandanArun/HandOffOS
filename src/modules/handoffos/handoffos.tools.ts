import { ExecutionContext, ToolDecorator as Tool, Widget, z } from '@nitrostack/core';

export class HandoffOSTools {
  @Tool({
    name: 'get_handoffos_status',
    description: 'Return the HandoffOS Phase 1 server status.',
    inputSchema: z.object({}),
    examples: {
      request: {},
      response: {
        name: 'HandoffOS',
        phase: 1,
        status: 'foundation_ready',
      },
    },
  })
  @Widget('handoffos-status')
  async getStatus(_input: Record<string, never>, context: ExecutionContext) {
    context.logger.info('Returning HandoffOS Phase 1 status');

    return {
      name: 'HandoffOS',
      tagline: 'Rules detect. AI explains. MCP acts.',
      phase: 1,
      status: 'foundation_ready',
      nextStep: 'Implement the deterministic workflow domain in Phase 2.',
    };
  }
}
