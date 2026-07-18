import { createHash } from 'node:crypto';
import type { AuditEntry, WorkflowState } from '../domain/types.js';

export interface AuditIntegrityResult {
  valid: boolean;
  checkedEntries: number;
  latestHash?: string;
  firstInvalidEntryId?: string;
  reason?: 'missing_hash' | 'previous_hash_mismatch' | 'entry_hash_mismatch';
}

type AuditEntryInput = Omit<AuditEntry, 'previousHash' | 'hash'>;

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function hashEntry(entry: AuditEntryInput & { previousHash: string | null }): string {
  const payload = JSON.stringify(canonicalize({
    id: entry.id,
    timestamp: entry.timestamp,
    action: entry.action,
    actor: entry.actor,
    details: entry.details,
    previousHash: entry.previousHash,
  }));
  return createHash('sha256').update(payload).digest('hex');
}

export function appendAuditEntry(state: WorkflowState, entry: AuditEntryInput): AuditEntry {
  const previousHash = state.auditLog.at(-1)?.hash ?? null;
  const chainedEntry: AuditEntry = {
    ...entry,
    previousHash,
    hash: hashEntry({ ...entry, previousHash }),
  };
  state.auditLog.push(chainedEntry);
  return chainedEntry;
}

export function verifyAuditIntegrity(entries: AuditEntry[]): AuditIntegrityResult {
  let previousHash: string | null = null;

  for (const entry of entries) {
    if (!entry.hash) {
      return { valid: false, checkedEntries: entries.indexOf(entry), firstInvalidEntryId: entry.id, reason: 'missing_hash' };
    }
    if ((entry.previousHash ?? null) !== previousHash) {
      return { valid: false, checkedEntries: entries.indexOf(entry), firstInvalidEntryId: entry.id, reason: 'previous_hash_mismatch' };
    }
    const expectedHash = hashEntry({
      id: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      actor: entry.actor,
      details: entry.details,
      previousHash,
    });
    if (entry.hash !== expectedHash) {
      return { valid: false, checkedEntries: entries.indexOf(entry), firstInvalidEntryId: entry.id, reason: 'entry_hash_mismatch' };
    }
    previousHash = entry.hash;
  }

  return {
    valid: true,
    checkedEntries: entries.length,
    latestHash: previousHash ?? undefined,
  };
}
