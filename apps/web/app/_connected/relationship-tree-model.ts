import type {
  CreateRelationshipChangeRequestInput,
  ParentChildSubtype,
  PartnershipSubtype,
  RelationshipGraphNodeDto,
  RelationshipGraphResponse,
} from '@family/contracts';

export interface TreeRow {
  level: number;
  members: RelationshipGraphNodeDto[];
}

export interface TreeConnection {
  relationship_id: string;
  member_id: string;
  label: string;
  kind: 'parent' | 'child' | 'partner';
}

export type RelationshipProposalChoice =
  | { kind: 'parent' | 'child'; subtype: ParentChildSubtype }
  | { kind: 'partner'; subtype: PartnershipSubtype };

export function buildTreeRows(graph: RelationshipGraphResponse): TreeRow[] {
  const levels = new Map<string, number>([[graph.root_member_id, 0]]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const relationship of graph.relationships) {
      const fromLevel = levels.get(relationship.from_member_id);
      const toLevel = levels.get(relationship.to_member_id);
      const difference = relationship.type === 'parent_child' ? 1 : 0;

      if (fromLevel !== undefined && toLevel === undefined) {
        levels.set(relationship.to_member_id, fromLevel + difference);
        changed = true;
      } else if (toLevel !== undefined && fromLevel === undefined) {
        levels.set(relationship.from_member_id, toLevel - difference);
        changed = true;
      }
    }
  }

  const rows = new Map<number, RelationshipGraphNodeDto[]>();
  for (const member of graph.nodes) {
    const level = levels.get(member.id);
    if (level === undefined) continue;
    const row = rows.get(level) ?? [];
    row.push(member);
    rows.set(level, row);
  }

  return [...rows.entries()]
    .sort(([left], [right]) => left - right)
    .map(([level, members]) => ({
      level,
      members: members.sort((left, right) =>
        left.display_name.localeCompare(right.display_name, 'vi'),
      ),
    }));
}

export function connectionsFor(
  graph: RelationshipGraphResponse,
  memberId: string,
): TreeConnection[] {
  return graph.relationships.flatMap<TreeConnection>((relationship) => {
    if (relationship.from_member_id !== memberId && relationship.to_member_id !== memberId) {
      return [];
    }

    if (relationship.type === 'partnership') {
      return [
        {
          relationship_id: relationship.id,
          member_id:
            relationship.from_member_id === memberId
              ? relationship.to_member_id
              : relationship.from_member_id,
          label: relationship.end_date ? 'Bạn đời trước đây' : 'Bạn đời',
          kind: 'partner',
        },
      ];
    }

    const isParent = relationship.from_member_id === memberId;
    const label = isParent
      ? relationship.subtype === 'adoptive'
        ? 'Con nuôi'
        : relationship.subtype === 'unspecified'
          ? 'Con · chưa rõ loại quan hệ'
          : 'Con'
      : relationship.subtype === 'adoptive'
        ? 'Cha / mẹ nuôi'
        : relationship.subtype === 'unspecified'
          ? 'Cha / mẹ · chưa rõ loại quan hệ'
          : 'Cha / mẹ';

    return [
      {
        relationship_id: relationship.id,
        member_id: isParent ? relationship.to_member_id : relationship.from_member_id,
        label,
        kind: isParent ? 'child' : 'parent',
      },
    ];
  });
}

export function relationshipProposal(
  selectedMemberId: string,
  targetMemberId: string,
  choice: RelationshipProposalChoice,
): CreateRelationshipChangeRequestInput {
  if (choice.kind === 'partner') {
    return {
      type: 'relationship_create',
      payload: {
        from_member_id: selectedMemberId,
        to_member_id: targetMemberId,
        type: 'partnership',
        subtype: choice.subtype,
      },
    };
  }

  return {
    type: 'relationship_create',
    payload: {
      from_member_id: choice.kind === 'parent' ? targetMemberId : selectedMemberId,
      to_member_id: choice.kind === 'parent' ? selectedMemberId : targetMemberId,
      type: 'parent_child',
      subtype: choice.subtype,
    },
  };
}
