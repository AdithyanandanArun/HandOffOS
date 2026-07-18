import type { WorkflowState, WorkflowNode } from '../domain/types.js';
import { LAPTOP_SLA_DEADLINE, ONBOARDING_SLA_DEADLINE } from '../domain/demo-clock.js';
import { SEED_EVENTS, SEED_EVIDENCE } from '../domain/events.js';

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
    targetDate: new Date('2025-01-13T09:00:00Z'),
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

const VENDOR_EVENTS: WorkflowState['events'] = [
  {
    id: 'VND-EVT-001',
    source: 'hr-system',
    timestamp: new Date('2025-01-07T08:00:00Z'),
    actor: 'Procurement Hub',
    type: 'task_registered',
    nodeId: 'security-review',
    logicalTaskKey: 'vendor-acme-security-review',
    payload: { vendorId: 'VENDOR-ACME', task: 'security-review' },
    evidenceId: 'VND-EVD-001',
  },
  {
    id: 'VND-EVT-002',
    source: 'task-board',
    timestamp: new Date('2025-01-07T08:02:00Z'),
    actor: 'Vendor Intake Bot',
    type: 'task_registered',
    nodeId: 'security-review',
    logicalTaskKey: 'vendor-acme-security-review',
    payload: { vendorId: 'VENDOR-ACME', task: 'security-review' },
    evidenceId: 'VND-EVD-002',
  },
  {
    id: 'VND-EVT-003',
    source: 'task-board',
    timestamp: new Date('2025-01-08T10:00:00Z'),
    actor: 'Vendor Intake Bot',
    type: 'status_reported',
    nodeId: 'security-review',
    logicalTaskKey: 'vendor-acme-security-review',
    reportedStatus: 'in_progress',
    payload: { vendorId: 'VENDOR-ACME', status: 'in_progress' },
    evidenceId: 'VND-EVD-003',
  },
  {
    id: 'VND-EVT-004',
    source: 'hr-system',
    timestamp: new Date('2025-01-08T10:03:00Z'),
    actor: 'Vendor Compliance System',
    type: 'status_reported',
    nodeId: 'security-review',
    logicalTaskKey: 'vendor-acme-security-review',
    reportedStatus: 'blocked',
    payload: { vendorId: 'VENDOR-ACME', status: 'blocked' },
    evidenceId: 'VND-EVD-004',
  },
];

const VENDOR_EVIDENCE: WorkflowState['evidence'] = VENDOR_EVENTS.map((event) => ({
  id: event.evidenceId,
  sourceEventId: event.id,
  type: 'event',
  description: `Vendor workflow event ${event.type} from ${event.source} for ${event.nodeId}.`,
  timestamp: event.timestamp,
}));

const VENDOR_NODES: WorkflowNode[] = [
  {
    id: 'vendor-intake',
    label: 'Vendor Intake',
    owner: 'Procurement Hub',
    status: 'completed',
    dependencies: [],
    completedAt: new Date('2025-01-06T14:00:00Z'),
    evidenceIds: [],
  },
  {
    id: 'security-review',
    label: 'Security Review',
    owner: 'Vendor Risk',
    status: 'blocked',
    dependencies: ['vendor-intake'],
    sla: new Date('2025-01-10T17:00:00Z'),
    ownerResponseSlaHours: 24,
    evidenceIds: ['VND-EVD-001', 'VND-EVD-002', 'VND-EVD-003', 'VND-EVD-004'],
  },
  {
    id: 'vendor-activation',
    label: 'Vendor Activation',
    owner: 'Procurement Hub',
    status: 'pending',
    dependencies: ['security-review'],
    evidenceIds: [],
  },
];

export function createVendorOnboardingState(): WorkflowState {
  return {
    workflowId: 'vendor-onboarding',
    label: 'Acme Vendor Onboarding',
    subject: 'Acme Analytics',
    targetDate: new Date('2025-01-17T17:00:00Z'),
    nodes: VENDOR_NODES.map((node) => ({ ...node, dependencies: [...node.dependencies], evidenceIds: [...node.evidenceIds] })),
    events: VENDOR_EVENTS.map((event) => ({ ...event, payload: { ...event.payload } })),
    evidence: VENDOR_EVIDENCE.map((evidence) => ({ ...evidence })),
    findings: [],
    rootBlocker: null,
    criticalPath: [],
    health: 100,
    estimatedCompletion: null,
    auditLog: [],
  };
}

export function createSeedStates(): WorkflowState[] {
  return [createSeedState(), createVendorOnboardingState()];
}
