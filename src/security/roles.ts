// Framework-independent role and capability model for HandoffOS.
//
// Capabilities are named after the deterministic workflow operations they guard.
// This module intentionally imports nothing from NitroStack, React, or any AI SDK
// so the policy layer can be reasoned about (and tested) in isolation.

export type Role = 'viewer' | 'analyst' | 'operator' | 'approver' | 'auditor' | 'admin';

export type Capability =
  | 'read_workflow_analysis'
  | 'simulate_resolution'
  | 'simulate_multi'
  | 'predict_completion'
  | 'escalate_blocker'
  | 'compare_workflows'
  | 'plan_next_actions'
  | 'ingest_event'
  | 'subscribe_alerts'
  | 'execute_action'
  | 'rollback_action'
  | 'export_audit_report'
  | 'verify_integrity'
  | 'reset_demo';

// Every capability the system recognises. Ordered by the role that introduces it.
export const ALL_CAPABILITIES: readonly Capability[] = [
  'read_workflow_analysis',
  'simulate_resolution',
  'simulate_multi',
  'predict_completion',
  'escalate_blocker',
  'compare_workflows',
  'plan_next_actions',
  'ingest_event',
  'subscribe_alerts',
  'execute_action',
  'rollback_action',
  'export_audit_report',
  'verify_integrity',
  'reset_demo',
];

const VIEWER_CAPABILITIES: readonly Capability[] = ['read_workflow_analysis'];

const ANALYST_CAPABILITIES: readonly Capability[] = [
  'simulate_resolution',
  'simulate_multi',
  'predict_completion',
  'escalate_blocker',
  'compare_workflows',
  'plan_next_actions',
];

const OPERATOR_CAPABILITIES: readonly Capability[] = ['ingest_event', 'subscribe_alerts'];

const APPROVER_CAPABILITIES: readonly Capability[] = ['execute_action', 'rollback_action'];

const AUDITOR_CAPABILITIES: readonly Capability[] = ['export_audit_report', 'verify_integrity'];

// Roles are flat (not hierarchical): a principal holds capabilities only from the
// roles it is granted. `admin` is the exception — it holds every capability,
// including demo reset, which no other role has.
export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  viewer: VIEWER_CAPABILITIES,
  analyst: ANALYST_CAPABILITIES,
  operator: OPERATOR_CAPABILITIES,
  approver: APPROVER_CAPABILITIES,
  auditor: AUDITOR_CAPABILITIES,
  admin: ALL_CAPABILITIES,
};

// Which roles would grant a capability — surfaced in authorization errors so a
// caller can see what access level the denied operation requires.
export function rolesForCapability(capability: Capability): Role[] {
  return (Object.keys(ROLE_CAPABILITIES) as Role[]).filter((role) =>
    ROLE_CAPABILITIES[role].includes(capability),
  );
}
