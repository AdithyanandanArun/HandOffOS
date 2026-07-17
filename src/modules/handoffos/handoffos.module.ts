import { Module } from '@nitrostack/core';
import { HandoffOSTools } from './handoffos.tools.js';
import { HandoffOSResources } from './handoffos.resources.js';
import { HandoffOSPrompts } from './handoffos.prompts.js';

@Module({
  name: 'handoffos',
  description: 'HandoffOS foundation module',
  controllers: [HandoffOSTools, HandoffOSResources, HandoffOSPrompts]
})
export class HandoffOSModule {}
