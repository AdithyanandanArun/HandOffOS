import type { WorkflowState, WorkflowNode, SourceEvent, Evidence, AuditEntry, AlertSubscription } from '../domain/types.js';

export interface WorkflowStateStore {
  getState(workflowId: string): WorkflowState | null;
  setState(state: WorkflowState): void;
  getNode(workflowId: string, nodeId: string): WorkflowNode | null;
  addEvent(workflowId: string, event: SourceEvent): void;
  addEvidence(workflowId: string, evidence: Evidence): void;
  addAuditEntry(workflowId: string, entry: AuditEntry): void;
  updateNode(workflowId: string, nodeId: string, updates: Partial<WorkflowNode>): void;
  // Phase 2 additions
  getPreviousState(workflowId: string): WorkflowState | null;
  listWorkflowIds(): string[];
  getStates(workflowIds: string[]): WorkflowState[];
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

  setState(state: WorkflowState): void {
    const oldState = this.states.get(state.workflowId);
    if (oldState) {
      const lastAudit = state.auditLog[state.auditLog.length - 1];
      const isStateChangingAction = lastAudit && 
        lastAudit.action !== 'Enterprise event ingested';

      if (isStateChangingAction) {
        if (!this.history.has(state.workflowId)) {
          this.history.set(state.workflowId, []);
        }
        this.history.get(state.workflowId)!.push(deepClone(oldState));
      }
    }
    this.states.set(state.workflowId, deepClone(state));
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

  // Phase 2 additions
  getPreviousState(workflowId: string): WorkflowState | null {
    const historyList = this.history.get(workflowId);
    if (!historyList || historyList.length === 0) return null;
    const prevState = historyList.pop()!;
    return deepClone(prevState);
  }

  listWorkflowIds(): string[] {
    return Array.from(this.states.keys());
  }

  getStates(workflowIds: string[]): WorkflowState[] {
    return workflowIds
      .map(id => this.getState(id))
      .filter((s): s is WorkflowState => s !== null);
  }
}

export interface AlertSubscriptionStore {
  addSubscription(sub: AlertSubscription): void;
  listSubscriptions(): AlertSubscription[];
  removeSubscription(id: string): void;
}

export class InMemoryAlertSubscriptionStore implements AlertSubscriptionStore {
  private subscriptions = new Map<string, AlertSubscription>();

  addSubscription(sub: AlertSubscription): void {
    this.subscriptions.set(sub.id, deepClone(sub));
  }

  listSubscriptions(): AlertSubscription[] {
    return Array.from(this.subscriptions.values()).map(s => deepClone(s));
  }

  removeSubscription(id: string): void {
    this.subscriptions.delete(id);
  }
}

