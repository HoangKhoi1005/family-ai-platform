import type { RelationshipGraphNodeDto, RelationshipGraphResponse } from '@family/contracts';
import { buildTreeRows, connectionsFor } from './relationship-tree-model';

const NODE_WIDTH = 148;
const COLUMN_GAP = 42;
const PARTNER_GAP = 24;
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

  const positions = new Map<string, { x: number; y: number }>();
  const nodes = buildTreeRows(visibleGraph).flatMap((row) => {
    const units = familyUnits(row.members, visibleRelationships).map((members) => {
      const parentCenters = visibleRelationships.flatMap<number>((relationship) => {
        if (relationship.type !== 'parent_child') return [];
        if (!members.some((member) => member.id === relationship.to_member_id)) return [];
        const parent = positions.get(relationship.from_member_id);
        return parent ? [parent.x + NODE_WIDTH / 2] : [];
      });
      return {
        members,
        width: members.length * NODE_WIDTH + (members.length - 1) * PARTNER_GAP,
        desiredCenter:
          parentCenters.length > 0
            ? parentCenters.reduce((sum, center) => sum + center, 0) / parentCenters.length
            : undefined,
      };
    });
    units.sort((left, right) => {
      if (left.desiredCenter !== undefined && right.desiredCenter !== undefined) {
        const byParent = left.desiredCenter - right.desiredCenter;
        if (byParent) return byParent;
      } else if (left.desiredCenter !== undefined) return -1;
      else if (right.desiredCenter !== undefined) return 1;
      return left.members[0]!.display_name.localeCompare(right.members[0]!.display_name, 'vi');
    });
    const totalWidth =
      units.reduce((sum, unit) => sum + unit.width, 0) + Math.max(0, units.length - 1) * COLUMN_GAP;
    let cursor = -totalWidth / 2;

    return units.flatMap((unit) => {
      if (units.length === 1 && unit.desiredCenter !== undefined) {
        cursor = unit.desiredCenter - unit.width / 2;
      }
      const seeds = unit.members.map<InteractiveTreeNodeSeed>((member, index) => {
        const position = {
          x: cursor + index * (NODE_WIDTH + PARTNER_GAP),
          y: row.level * ROW_GAP,
        };
        positions.set(member.id, position);
        return {
          id: member.id,
          member,
          position,
          isRoot: member.id === graph.root_member_id,
          hasBranch: branchIds.has(member.id),
          collapsed: collapsedIds.has(member.id),
          connectionLabel: rootConnections.get(member.id) ?? null,
        };
      });
      cursor += unit.width + COLUMN_GAP;
      return seeds;
    });
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

function familyUnits(
  members: RelationshipGraphNodeDto[],
  relationships: RelationshipGraphResponse['relationships'],
): RelationshipGraphNodeDto[][] {
  const byId = new Map(members.map((member) => [member.id, member]));
  const neighbors = new Map(members.map((member) => [member.id, new Set<string>()]));
  for (const relationship of relationships) {
    if (
      relationship.type !== 'partnership' ||
      relationship.end_date !== null ||
      !byId.has(relationship.from_member_id) ||
      !byId.has(relationship.to_member_id)
    ) {
      continue;
    }
    neighbors.get(relationship.from_member_id)!.add(relationship.to_member_id);
    neighbors.get(relationship.to_member_id)!.add(relationship.from_member_id);
  }
  const visited = new Set<string>();
  const units: RelationshipGraphNodeDto[][] = [];
  for (const member of [...members].sort((left, right) =>
    left.display_name.localeCompare(right.display_name, 'vi'),
  )) {
    if (visited.has(member.id)) continue;
    const queue = [member.id];
    const unit: RelationshipGraphNodeDto[] = [];
    visited.add(member.id);
    while (queue.length) {
      const id = queue.shift()!;
      unit.push(byId.get(id)!);
      for (const neighbor of neighbors.get(id) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    unit.sort((left, right) => left.display_name.localeCompare(right.display_name, 'vi'));
    units.push(unit);
  }
  return units;
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
