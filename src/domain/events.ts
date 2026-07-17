import type { SourceEvent, Evidence } from './types.js';

export const SEED_EVENTS: SourceEvent[] = [
  {
    id: 'EVT-001',
    source: 'gmail',
    timestamp: new Date('2025-01-06T09:15:00Z'),
    actor: 'Rajesh Kumar',
    type: 'approval_granted',
    payload: {
      subject: 'Approved: Priya Nair Onboarding',
      to: 'hr@company.com',
      body: 'I approve the onboarding of Priya Nair to my team effective 2025-01-13.',
    },
    evidenceId: 'EVD-001',
  },
  {
    id: 'EVT-002',
    source: 'hr-system',
    timestamp: new Date('2025-01-07T11:30:00Z'),
    actor: 'HR System',
    type: 'verification_completed',
    payload: {
      employeeId: 'EMP-2025-042',
      name: 'Priya Nair',
      bgCheckStatus: 'cleared',
      documentsVerified: true,
    },
    evidenceId: 'EVD-002',
  },
  {
    id: 'EVT-003',
    source: 'hr-system',
    timestamp: new Date('2025-01-07T11:35:00Z'),
    actor: 'HR System',
    type: 'it_request_triggered',
    payload: {
      requestType: 'laptop_provisioning',
      employeeId: 'EMP-2025-042',
      priority: 'high',
      sla: '2025-01-10T17:00:00Z',
    },
    evidenceId: 'EVD-003',
  },
  {
    id: 'EVT-004',
    source: 'task-board',
    timestamp: new Date('2025-01-08T14:00:00Z'),
    actor: 'Rajesh Kumar',
    type: 'approval_granted',
    payload: {
      approvalType: 'manager_signoff',
      scope: 'onboarding_priya_nair',
      note: 'Approved all onboarding steps.',
    },
    evidenceId: 'EVD-006',
  },
];

export const SEED_EVIDENCE: Evidence[] = [
  {
    id: 'EVD-001',
    sourceEventId: 'EVT-001',
    type: 'event',
    description: 'Manager approval email from Rajesh Kumar granting onboarding for Priya Nair.',
    timestamp: new Date('2025-01-06T09:15:00Z'),
  },
  {
    id: 'EVD-002',
    sourceEventId: 'EVT-002',
    type: 'event',
    description: 'HR system completed background check and document verification for Priya Nair.',
    timestamp: new Date('2025-01-07T11:30:00Z'),
  },
  {
    id: 'EVD-003',
    sourceEventId: 'EVT-003',
    type: 'event',
    description: 'HR system triggered IT laptop provisioning request with SLA 2025-01-10.',
    timestamp: new Date('2025-01-07T11:35:00Z'),
  },
  {
    id: 'EVD-004',
    sourceEventId: null,
    type: 'absence',
    description: 'No IT work order or task-board ticket found for laptop provisioning. The HR-triggered request was never actioned.',
    timestamp: new Date('2025-01-15T10:00:00Z'),
  },
  {
    id: 'EVD-005',
    sourceEventId: null,
    type: 'absence',
    description: 'No calendar event found for Priya Nair orientation session.',
    timestamp: new Date('2025-01-15T10:00:00Z'),
  },
  {
    id: 'EVD-006',
    sourceEventId: 'EVT-004',
    type: 'event',
    description: 'Manager signoff approval from Rajesh Kumar on 2025-01-08, now 7 days old without downstream action.',
    timestamp: new Date('2025-01-08T14:00:00Z'),
  },
];
