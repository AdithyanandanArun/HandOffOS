import { ExecutionContext, Injectable, ResourceDecorator as Resource } from '@nitrostack/core';
import { HandoffOSApplication } from '../../application/handoffos.application.js';

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
  constructor(private readonly application: HandoffOSApplication) {}

  @Resource({ uri: 'workflow://catalog', name: 'HandoffOS Workflow Catalog', description: 'All active workflow IDs with deterministic health and completion summaries.', mimeType: 'application/json' })
  async getCatalog(uri: string, context: ExecutionContext) {
    context.logger.info('Reading workflow catalog');
    return jsonResource(uri, await this.application.compareWorkflows());
  }

  @Resource({ uri: 'workflow://onboard-priya/state', name: 'Priya Onboarding Workflow State', description: 'Current workflow state for Priya Nair onboarding.', mimeType: 'application/json' })
  async getPriyaState(uri: string, context: ExecutionContext) {
    return this.getStateResource(uri, context, 'onboard-priya');
  }

  @Resource({ uri: 'workflow://onboard-priya/events', name: 'Priya Onboarding Events', description: 'Enterprise events used to reconstruct Priya Nair onboarding.', mimeType: 'application/json' })
  async getPriyaEvents(uri: string, context: ExecutionContext) {
    return this.getEventsResource(uri, context, 'onboard-priya');
  }

  @Resource({ uri: 'workflow://onboard-priya/findings', name: 'Priya Onboarding Findings', description: 'Deterministic blocker findings and evidence references.', mimeType: 'application/json' })
  async getPriyaFindings(uri: string, context: ExecutionContext) {
    return this.getFindingsResource(uri, context, 'onboard-priya');
  }

  @Resource({ uri: 'workflow://onboard-priya/audit-log', name: 'Priya Onboarding Audit Log', description: 'Tamper-evident audit records for Priya onboarding.', mimeType: 'application/json' })
  async getPriyaAuditLog(uri: string, context: ExecutionContext) {
    return this.getAuditLogResource(uri, context, 'onboard-priya');
  }

  @Resource({ uri: 'workflow://onboard-priya/audit-integrity', name: 'Priya Onboarding Audit Integrity', description: 'SHA-256 audit-chain integrity result for Priya onboarding.', mimeType: 'application/json' })
  async getPriyaAuditIntegrity(uri: string, context: ExecutionContext) {
    return this.getAuditIntegrityResource(uri, context, 'onboard-priya');
  }

  @Resource({ uri: 'workflow://vendor-onboarding/state', name: 'Vendor Onboarding Workflow State', description: 'Current workflow state for Acme vendor onboarding.', mimeType: 'application/json' })
  async getVendorState(uri: string, context: ExecutionContext) {
    return this.getStateResource(uri, context, 'vendor-onboarding');
  }

  @Resource({ uri: 'workflow://vendor-onboarding/events', name: 'Vendor Onboarding Events', description: 'Source events for the vendor workflow.', mimeType: 'application/json' })
  async getVendorEvents(uri: string, context: ExecutionContext) {
    return this.getEventsResource(uri, context, 'vendor-onboarding');
  }

  @Resource({ uri: 'workflow://vendor-onboarding/findings', name: 'Vendor Onboarding Findings', description: 'Deterministic findings for vendor onboarding.', mimeType: 'application/json' })
  async getVendorFindings(uri: string, context: ExecutionContext) {
    return this.getFindingsResource(uri, context, 'vendor-onboarding');
  }

  @Resource({ uri: 'workflow://vendor-onboarding/audit-log', name: 'Vendor Onboarding Audit Log', description: 'Tamper-evident audit records for vendor onboarding.', mimeType: 'application/json' })
  async getVendorAuditLog(uri: string, context: ExecutionContext) {
    return this.getAuditLogResource(uri, context, 'vendor-onboarding');
  }

  @Resource({ uri: 'workflow://vendor-onboarding/audit-integrity', name: 'Vendor Onboarding Audit Integrity', description: 'SHA-256 audit-chain integrity result for vendor onboarding.', mimeType: 'application/json' })
  async getVendorAuditIntegrity(uri: string, context: ExecutionContext) {
    return this.getAuditIntegrityResource(uri, context, 'vendor-onboarding');
  }

  @Resource({ uri: 'workflow://rules', name: 'HandoffOS Rules', description: 'Deterministic workflow rules used to create findings.', mimeType: 'application/json' })
  async getRules(uri: string, context: ExecutionContext) {
    context.logger.info('Reading deterministic workflow rules');
    return jsonResource(uri, await this.application.getRules());
  }

  private async getStateResource(uri: string, context: ExecutionContext, workflowId: string) {
    context.logger.info('Reading workflow state', { workflowId });
    return jsonResource(uri, await this.application.getState(workflowId));
  }

  private async getEventsResource(uri: string, context: ExecutionContext, workflowId: string) {
    context.logger.info('Reading workflow events', { workflowId });
    return jsonResource(uri, await this.application.getEvents(workflowId));
  }

  private async getFindingsResource(uri: string, context: ExecutionContext, workflowId: string) {
    context.logger.info('Reading workflow findings', { workflowId });
    return jsonResource(uri, await this.application.getFindings(workflowId));
  }

  private async getAuditLogResource(uri: string, context: ExecutionContext, workflowId: string) {
    context.logger.info('Reading workflow audit log', { workflowId });
    return jsonResource(uri, await this.application.getAuditLog(workflowId));
  }

  private async getAuditIntegrityResource(uri: string, context: ExecutionContext, workflowId: string) {
    context.logger.info('Reading workflow audit integrity', { workflowId });
    return jsonResource(uri, await this.application.verifyAuditIntegrity(workflowId));
  }
}
