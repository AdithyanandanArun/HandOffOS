import type { AlertSubscription } from '../domain/types.js';

export class AlertSubscriptionStore {
  private readonly subscriptions = new Map<string, AlertSubscription>();

  add(subscription: AlertSubscription): AlertSubscription {
    if (this.subscriptions.has(subscription.id)) {
      throw new Error(`Alert subscription "${subscription.id}" already exists.`);
    }
    const copy = structuredClone(subscription);
    this.subscriptions.set(copy.id, copy);
    return structuredClone(copy);
  }

  list(workflowId?: string): AlertSubscription[] {
    return [...this.subscriptions.values()]
      .filter((subscription) => !workflowId || subscription.workflowId === workflowId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((subscription) => structuredClone(subscription));
  }

  remove(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }
}
