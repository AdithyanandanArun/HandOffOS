import type { WorkflowState, WorkflowNode } from '../domain/types.ts';
import { LAPTOP_SLA_DEADLINE, ONBOARDING_SLA_DEADLINE } from '../domain/demo-clock.ts';
import { SEED_EVENTS, SEED_EVIDENCE } from '../domain/events.ts';

const SEED_NODES: WorkflowNode[] = [
  {
    id: 'manager-approval',
    label: 'Manager Approval',
    owner: 'Rajesh Kumar',
    status: 'completed',
    dependencies: [],
    completedAt: new Date('2025-01-06T09:15:00Z'),
    evidenceIds: ['EVD-001'],
  },
  {
    id: 'hr-verification',
    label: 'HR Verification',
    owner: 'HR Team',
    status: 'completed',
    dependencies: ['manager-approval'],
    completedAt: new Date('2025-01-07T11:30:00Z'),
    evidenceIds: ['EVD-002'],
  },
  {
    id: 'laptop-allocation',
    label: 'Laptop Allocation',
    owner: 'IT Ops',
    status: 'blocked',
    dependencies: ['hr-verification'],
    sla: LAPTOP_SLA_DEADLINE,
    evidenceIds: ['EVD-003', 'EVD-004'],
  },
  {
    id: 'identity-access',
    label: 'Identity Access',
    owner: 'IT Security',
    status: 'blocked',
    dependencies: ['laptop-allocation'],
    evidenceIds: [],
  },
  {
    id: 'vpn-setup',
    label: 'VPN Setup',
    owner: 'IT Network',
    status: 'blocked',
    dependencies: ['laptop-allocation'],
    evidenceIds: [],
  },
  {
    id: 'developer-access',
    label: 'Developer Access',
    owner: 'DevOps',
    status: 'pending',
    dependencies: ['identity-access', 'vpn-setup'],
    evidenceIds: [],
  },
  {
    id: 'orientation',
    label: 'Orientation',
    owner: 'HR Team',
    status: 'pending',
    dependencies: ['developer-access'],
    sla: ONBOARDING_SLA_DEADLINE,
    evidenceIds: ['EVD-005'],
  },
];

export function createSeedState(): WorkflowState {
  return {
    workflowId: 'onboard-priya',
    label: 'Priya Nair Onboarding',
    subject: 'Priya Nair',
    nodes: SEED_NODES.map(n => ({ ...n, dependencies: [...n.dependencies], evidenceIds: [...n.evidenceIds] })),
    events: SEED_EVENTS.map(e => ({ ...e, payload: { ...e.payload } })),
    evidence: SEED_EVIDENCE.map(e => ({ ...e })),
    findings: [],
    rootBlocker: null,
    criticalPath: [],
    health: 100,
    estimatedCompletion: null,
    auditLog: [],
  };
}
