import { Module } from '@nitrostack/core';
import { HandoffOSTools } from './handoffos.tools.js';
import { HandoffOSResources } from './handoffos.resources.js';
import { HandoffOSPrompts } from './handoffos.prompts.js';
import { HandoffOSApplication } from '../../application/handoffos.application.js';
import { HandoffOSRuntime } from '../../application/handoffos.runtime.js';

@Module({
  name: 'handoffos',
  description: 'HandoffOS workflow intelligence module',
  controllers: [HandoffOSTools, HandoffOSResources, HandoffOSPrompts],
  providers: [HandoffOSRuntime, HandoffOSApplication],
})
export class HandoffOSModule {}
