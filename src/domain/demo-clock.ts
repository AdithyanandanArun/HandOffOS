// Deterministic clock so SLA calculations and completion estimates are repeatable.
const DEMO_NOW = new Date('2025-01-15T10:00:00Z');

export function demoNow(): Date {
  return new Date(DEMO_NOW.getTime());
}

export const PRIYA_JOINING_DATE = new Date('2025-01-13T09:00:00Z');

export const LAPTOP_SLA_DEADLINE = new Date('2025-01-10T17:00:00Z');

export const ONBOARDING_SLA_DEADLINE = new Date('2025-01-14T17:00:00Z');

export const ESTIMATED_TASK_DURATION_DAYS = 1;
