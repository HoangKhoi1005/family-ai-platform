import type { RelationshipGraphNodeDto, RelationshipGraphResponse } from '@family/contracts';
import { buildTreeRows, connectionsFor } from './relationship-tree-model';

const NODE_WIDTH = 148;
const COLUMN_GAP = 42;
const ROW_GAP = 220;

export interface InteractiveTreeNodeSeed {
  id: string;
  member: RelationshipGraphNodeDto;
  position: { x: number; y: number };
  isRoot: boolean;
  hasBranch: boolean;
  collapsed: boolean;
  connectionLabel: string | null;
}

export interface InteractiveTreeEdgeSeed {
  id: string;
  source: string;
  target: string;
  kind: 'parent_child' | 'partnership';
  subtype: string;
  historical: boolean;
}

export interface InteractiveTreeLayout {
  nodes: InteractiveTreeNodeSeed[];
  edges: InteractiveTreeEdgeSeed[];
}

export function buildInteractiveTreeLayout(
  graph: RelationshipGraphResponse,
  collapsedIds: ReadonlySet<string>,
): InteractiveTreeLayout {
  const hiddenIds = hiddenBranchIds(graph, collapsedIds);
  const visibleNodes = graph.nodes.filter((node) => !hiddenIds.has(node.id));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleRelationships = graph.relationships.filter(
    (relationship) =>
      visibleIds.has(relationship.from_member_id) && visibleIds.has(relationship.to_member_id),
  );
  const visibleGraph: RelationshipGraphResponse = {
    ...graph,
    nodes: visibleNodes,
    relationships: visibleRelationships,
  };
  const rootConnections = new Map(
    connectionsFor(graph, graph.root_member_id).map((connection) => [
      connection.member_id,
      connection.label,
    ]),
  );
  const branchIds = branchNodeIds(graph);

  const nodes = buildTreeRows(visibleGraph).flatMap((row) => {
    const rowWidth = row.members.length * NODE_WIDTH + (row.members.length - 1) * COLUMN_GAP;
    const left = -rowWidth / 2;

    return row.members.map<InteractiveTreeNodeSeed>((member, index) => ({
      id: member.id,
      member,
      position: {
        x: left + index * (NODE_WIDTH + COLUMN_GAP),
        y: row.level * ROW_GAP,
      },
      isRoot: member.id === graph.root_member_id,
      hasBranch: branchIds.has(member.id),
      collapsed: collapsedIds.has(member.id),
      connectionLabel: rootConnections.get(member.id) ?? null,
    }));
  });

  return {
    nodes,
    edges: visibleRelationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.from_member_id,
      target: relationship.to_member_id,
      kind: relationship.type,
      subtype: relationship.subtype,
      historical: Boolean(relationship.end_date),
    })),
  };
}

function graphAdjacency(graph: RelationshipGraphResponse) {
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) adjacency.set(node.id, new Set());
  for (const relationship of graph.relationships) {
    adjacency.get(relationship.from_member_id)?.add(relationship.to_member_id);
    adjacency.get(relationship.to_member_id)?.add(relationship.from_member_id);
  }
  return adjacency;
}

function branchNodeIds(graph: RelationshipGraphResponse) {
  const distances = new Map(graph.nodes.map((node) => [node.id, node.distance]));
  const adjacency = graphAdjacency(graph);
  return new Set(
    graph.nodes
      .filter((node) =>
        [...(adjacency.get(node.id) ?? [])].some(
          (neighborId) => (distances.get(neighborId) ?? -1) > node.distance,
        ),
      )
      .map((node) => node.id),
  );
}

function hiddenBranchIds(graph: RelationshipGraphResponse, collapsedIds: ReadonlySet<string>) {
  const distances = new Map(graph.nodes.map((node) => [node.id, node.distance]));
  const adjacency = graphAdjacency(graph);
  const hidden = new Set<string>();

  for (const collapsedId of collapsedIds) {
    const queue = [collapsedId];
    const visited = new Set(queue);

    while (queue.length) {
      const currentId = queue.shift();
      if (!currentId) continue;
      const currentDistance = distances.get(currentId);
      if (currentDistance === undefined) continue;

      for (const neighborId of adjacency.get(currentId) ?? []) {
        if (visited.has(neighborId)) continue;
        const neighborDistance = distances.get(neighborId);
        if (neighborDistance === undefined || neighborDistance <= currentDistance) continue;
        visited.add(neighborId);
        hidden.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return hidden;
}
