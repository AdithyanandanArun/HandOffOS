/**
 * graph.ts — workflow graph traversal helpers.
 *
 * Owned by G (workflow domain layer). No imports from NitroStack, React, or any AI SDK.
 * All functions operate on read-only WorkflowState and return new arrays; they do not
 * mutate state.
 */

import type { WorkflowState, WorkflowNode, NodeStatus } from '../domain/types.js';

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function nodeById(state: WorkflowState, id: string): WorkflowNode | undefined {
  return state.nodes.find(n => n.id === id);
}

// ---------------------------------------------------------------------------
// Dependency checks
// ---------------------------------------------------------------------------

/**
 * Returns true when every in-graph dependency of the given node is completed.
 */
export function areDependenciesComplete(state: WorkflowState, nodeId: string): boolean {
  const node = nodeById(state, nodeId);
  if (!node) return false;
  return node.dependencies.every(depId => {
    const dep = nodeById(state, depId);
    return dep !== undefined && dep.status === 'completed';
  });
}

/**
 * Returns the IDs of any in-graph dependencies that are not yet completed.
 */
export function getIncompleteDependencies(state: WorkflowState, nodeId: string): string[] {
  const node = nodeById(state, nodeId);
  if (!node) return [];
  return node.dependencies.filter(depId => {
    const dep = nodeById(state, depId);
    return dep === undefined || dep.status !== 'completed';
  });
}

// ---------------------------------------------------------------------------
// Downstream nodes
// ---------------------------------------------------------------------------

/**
 * Returns all node IDs that are (transitively) downstream of the given node,
 * i.e. nodes that depend on it directly or indirectly.
 * The starting node is not included in the result.
 */
export function getDownstreamNodes(state: WorkflowState, nodeId: string): string[] {
  const downstream: string[] = [];
  const visited = new Set<string>();

  function traverse(id: string): void {
    for (const node of state.nodes) {
      if (node.dependencies.includes(id) && !visited.has(node.id)) {
        visited.add(node.id);
        downstream.push(node.id);
        traverse(node.id);
      }
    }
  }

  traverse(nodeId);
  return downstream;
}

// ---------------------------------------------------------------------------
// Critical path
// ---------------------------------------------------------------------------

/**
 * Computes the critical path through the workflow — the longest dependency
 * chain from any root node (a node with no dependencies) to a leaf node
 * (a node with no dependents).
 *
 * Returns an ordered array of node IDs from the root of the longest chain
 * to its leaf.
 */
export function computeCriticalPath(state: WorkflowState): string[] {
  function longestPathFrom(nodeId: string, visited: Set<string>): string[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const dependents = state.nodes.filter(n => n.dependencies.includes(nodeId));

    if (dependents.length === 0) {
      visited.delete(nodeId);
      return [nodeId];
    }

    let longest: string[] = [];
    for (const dep of dependents) {
      const path = longestPathFrom(dep.id, visited);
      if (path.length > longest.length) longest = path;
    }

    visited.delete(nodeId);
    return [nodeId, ...longest];
  }

  const roots = state.nodes.filter(n => n.dependencies.length === 0);
  let criticalPath: string[] = [];

  for (const root of roots) {
    const path = longestPathFrom(root.id, new Set());
    if (path.length > criticalPath.length) criticalPath = path;
  }

  return criticalPath;
}

// ---------------------------------------------------------------------------
// Root blocker
// ---------------------------------------------------------------------------

/**
 * Returns the node ID of the first blocked node on the critical path, which
 * is the root cause of downstream stalls. Falls back to the first blocked
 * node in the graph if no critical-path blocker is found.
 *
 * Returns null when the workflow has no blocked nodes.
 */
export function findRootBlocker(state: WorkflowState): string | null {
  const criticalPath = computeCriticalPath(state);

  for (const nodeId of criticalPath) {
    const node = nodeById(state, nodeId);
    if (node && node.status === 'blocked') {
      return node.id;
    }
  }

  // Fallback: first blocked node anywhere in the graph
  const anyBlocked = state.nodes.find(n => n.status === 'blocked');
  return anyBlocked ? anyBlocked.id : null;
}

// ---------------------------------------------------------------------------
// Status propagation
// ---------------------------------------------------------------------------

/**
 * Derives the correct status for a node given the current state of its
 * dependencies. This is used after a state mutation to propagate changes
 * without calling the full rules engine.
 *
 * Rules:
 *  - If the node is already completed, leave it completed.
 *  - If any dependency is blocked, the node is blocked.
 *  - If any dependency is incomplete (pending/ready/in_progress), the node is pending.
 *  - If all dependencies are completed, the node is ready (caller may promote to in_progress).
 */
export function deriveNodeStatus(state: WorkflowState, nodeId: string): NodeStatus {
  const node = nodeById(state, nodeId);
  if (!node) return 'pending';
  if (node.status === 'completed') return 'completed';

  if (node.dependencies.length === 0) return 'ready';

  const deps = node.dependencies.map(id => nodeById(state, id));
  if (deps.some(d => d?.status === 'blocked')) return 'blocked';
  if (deps.every(d => d?.status === 'completed')) return 'ready';
  return 'pending';
}

/**
 * Propagates status changes through all downstream nodes after a node has
 * been mutated. Returns a new nodes array — does not mutate the input.
 */
export function propagateStatuses(state: WorkflowState): WorkflowState {
  // Topological order: process nodes whose dependencies appear earlier
  const ordered: string[] = [];
  const placed = new Set<string>();

  function place(id: string): void {
    if (placed.has(id)) return;
    const node = nodeById(state, id);
    if (!node) return;
    for (const dep of node.dependencies) place(dep);
    if (!placed.has(id)) {
      placed.add(id);
      ordered.push(id);
    }
  }

  for (const n of state.nodes) place(n.id);

  // Build a mutable copy of the nodes array
  const updatedNodes = state.nodes.map(n => ({ ...n, dependencies: [...n.dependencies], evidenceIds: [...n.evidenceIds] }));

  for (const id of ordered) {
    const idx = updatedNodes.findIndex(n => n.id === id);
    if (idx === -1) continue;
    const node = updatedNodes[idx];
    if (node.status === 'completed') continue;

    const deps = node.dependencies.map(depId => updatedNodes.find(n => n.id === depId));
    let newStatus: NodeStatus;
    if (node.dependencies.length === 0) {
      newStatus = 'ready';
    } else if (deps.some(d => d?.status === 'blocked')) {
      newStatus = 'blocked';
    } else if (deps.every(d => d?.status === 'completed')) {
      newStatus = 'ready';
    } else {
      newStatus = 'pending';
    }

    updatedNodes[idx] = { ...node, status: newStatus };
  }

  return { ...state, nodes: updatedNodes };
}
