import type { Role } from './roles.js';

// A principal is any identity that can attempt a capability. Principals carry the
// roles they hold; capabilities are derived from those roles by the PolicyService.
export interface Principal {
  id: string;
  displayName: string;
  roles: Role[];
}

// Deterministic demo principals — one per role — so the seeded workflow demo can
// exercise every access level without an external identity provider.
export const SEED_PRINCIPALS: Principal[] = [
  { id: 'demo-viewer', displayName: 'Demo Viewer', roles: ['viewer'] },
  { id: 'ops-analyst', displayName: 'Operations Analyst', roles: ['analyst'] },
  { id: 'it-operator', displayName: 'IT Operator', roles: ['operator'] },
  { id: 'it-director', displayName: 'IT Director', roles: ['approver'] },
  { id: 'risk-auditor', displayName: 'Risk Auditor', roles: ['auditor'] },
  { id: 'workflow-admin', displayName: 'Workflow Admin', roles: ['admin'] },
];
