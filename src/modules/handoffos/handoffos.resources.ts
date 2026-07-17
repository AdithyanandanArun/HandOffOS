import { ExecutionContext, ResourceDecorator as Resource } from '@nitrostack/core';

export class HandoffOSResources {
  @Resource({
    uri: 'handoffos://status',
    name: 'HandoffOS Foundation Status',
    description: 'Phase 1 server and implementation status.',
    mimeType: 'application/json',
  })
  async getStatus(uri: string, context: ExecutionContext) {
    context.logger.info('Reading HandoffOS foundation status');

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          name: 'HandoffOS',
          phase: 1,
          status: 'foundation_ready',
          nextPhase: 'Workflow domain contracts and seeded onboarding state',
        }, null, 2),
      }],
    };
  }
}
