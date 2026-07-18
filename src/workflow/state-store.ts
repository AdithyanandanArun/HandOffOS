import type { WorkflowState, WorkflowNode, SourceEvent, Evidence, AuditEntry } from '../domain/types.js';

export interface WorkflowStateStore {
  getState(workflowId: string): WorkflowState | null;
  getStates(workflowIds?: string[]): WorkflowState[];
  listWorkflowIds(): string[];
  clear(): void;
  setState(state: WorkflowState): void;
  recordHistory(workflowId: string, state: WorkflowState): void;
  getPreviousState(workflowId: string): WorkflowState | null;
  restorePreviousState(workflowId: string): WorkflowState | null;
  getNode(workflowId: string, nodeId: string): WorkflowNode | null;
  addEvent(workflowId: string, event: SourceEvent): void;
  addEvidence(workflowId: string, evidence: Evidence): void;
  addAuditEntry(workflowId: string, entry: AuditEntry): void;
  updateNode(workflowId: string, nodeId: string, updates: Partial<WorkflowNode>): void;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export class InMemoryWorkflowStateStore implements WorkflowStateStore {
  private states = new Map<string, WorkflowState>();
  private history = new Map<string, WorkflowState[]>();

  getState(workflowId: string): WorkflowState | null {
    const state = this.states.get(workflowId);
    return state ? deepClone(state) : null;
  }

  getStates(workflowIds?: string[]): WorkflowState[] {
    const ids = workflowIds?.length ? workflowIds : this.listWorkflowIds();
    return ids.flatMap((workflowId) => {
      const state = this.getState(workflowId);
      return state ? [state] : [];
    });
  }

  listWorkflowIds(): string[] {
    return [...this.states.keys()].sort();
  }

  clear(): void {
    this.states.clear();
    this.history.clear();
  }

  setState(state: WorkflowState): void {
    this.states.set(state.workflowId, deepClone(state));
  }

  recordHistory(workflowId: string, state: WorkflowState): void {
    const entries = this.history.get(workflowId) ?? [];
    entries.push(deepClone(state));
    this.history.set(workflowId, entries);
  }

  getPreviousState(workflowId: string): WorkflowState | null {
    const entries = this.history.get(workflowId);
    const previous = entries?.at(-1);
    return previous ? deepClone(previous) : null;
  }

  restorePreviousState(workflowId: string): WorkflowState | null {
    const entries = this.history.get(workflowId);
    const previous = entries?.pop();
    if (!previous) return null;
    const restored = deepClone(previous);
    this.states.set(workflowId, restored);
    return deepClone(restored);
  }

  getNode(workflowId: string, nodeId: string): WorkflowNode | null {
    const state = this.states.get(workflowId);
    if (!state) return null;
    const node = state.nodes.find(n => n.id === nodeId);
    return node ? deepClone(node) : null;
  }

  addEvent(workflowId: string, event: SourceEvent): void {
    const state = this.states.get(workflowId);
    if (state) state.events.push(deepClone(event));
  }

  addEvidence(workflowId: string, evidence: Evidence): void {
    const state = this.states.get(workflowId);
    if (state) state.evidence.push(deepClone(evidence));
  }

  addAuditEntry(workflowId: string, entry: AuditEntry): void {
    const state = this.states.get(workflowId);
    if (state) state.auditLog.push(deepClone(entry));
  }

  updateNode(workflowId: string, nodeId: string, updates: Partial<WorkflowNode>): void {
    const state = this.states.get(workflowId);
    if (!state) return;
    const node = state.nodes.find(n => n.id === nodeId);
    if (node) Object.assign(node, updates);
  }
}
