import type { OwnerWorkload, WorkflowState } from '../domain/types.js';

export function getOwnerWorkload(states: WorkflowState[], ownerId: string): OwnerWorkload {
  const ownedNodes = states.flatMap((state) => state.nodes.filter((node) => node.owner === ownerId));
  const ownedNodeIds = new Set(ownedNodes.map((node) => node.id));

  return {
    ownerId,
    openNodeIds: ownedNodes
      .filter((node) => node.status !== 'completed')
      .map((node) => node.id)
      .sort(),
    activeFindingIds: states
      .flatMap((state) => state.findings)
      .filter((finding) => finding.affectedNodeIds.some((nodeId) => ownedNodeIds.has(nodeId)))
      .map((finding) => finding.id)
      .sort(),
  };
}
