import { ExecutionContext, ResourceDecorator as Resource, Injectable } from '@nitrostack/core';
import { HandoffOSApplication } from '../../application/handoffos.application.js';

const workflowId = 'onboard-priya';

function jsonResource(uri: string, value: unknown) {
  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(value, null, 2),
    }],
  };
}

@Injectable({ deps: [HandoffOSApplication] })
export class HandoffOSResources {
  constructor(private readonly app: HandoffOSApplication) {}

  @Resource({
    uri: 'workflow://onboard-priya/state',
    name: 'Priya Onboarding Workflow State',
    description: 'Current workflow state for Priya Nair onboarding.',
    mimeType: 'application/json',
  })
  async getState(uri: string, context: ExecutionContext) {
    context.logger.info('Reading workflow state', { workflowId });
    return jsonResource(uri, await this.app.getState(workflowId));
  }

  @Resource({
    uri: 'workflow://onboard-priya/events',
    name: 'Priya Onboarding Events',
    description: 'Enterprise events used to reconstruct Priya Nair onboarding.',
    mimeType: 'application/json',
  })
  async getEvents(uri: string, context: ExecutionContext) {
    context.logger.info('Reading workflow events', { workflowId });
    return jsonResource(uri, await this.app.getEvents(workflowId));
  }

  @Resource({
    uri: 'workflow://onboard-priya/findings',
    name: 'Priya Onboarding Findings',
    description: 'Deterministic blocker findings and their evidence references.',
    mimeType: 'application/json',
  })
  async getFindings(uri: string, context: ExecutionContext) {
    context.logger.info('Reading workflow findings', { workflowId });
    return jsonResource(uri, await this.app.getFindings(workflowId));
  }

  @Resource({
    uri: 'workflow://onboard-priya/audit-log',
    name: 'Priya Onboarding Audit Log',
    description: 'Auditable workflow actions and recalculations.',
    mimeType: 'application/json',
  })
  async getAuditLog(uri: string, context: ExecutionContext) {
    context.logger.info('Reading workflow audit log', { workflowId });
    return jsonResource(uri, await this.app.getAuditLog(workflowId));
  }

  @Resource({
    uri: 'workflow://rules',
    name: 'HandoffOS Rules',
    description: 'Deterministic workflow rules used to create findings.',
    mimeType: 'application/json',
  })
  async getRules(uri: string, context: ExecutionContext) {
    context.logger.info('Reading deterministic workflow rules');
    return jsonResource(uri, await this.app.getRules());
  }
}

