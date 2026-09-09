import { describe, expect, it } from 'vitest';
import type { RelationshipGraphResponse } from '@family/contracts';
import { buildTreeRows, connectionsFor, relationshipProposal } from './relationship-tree-model';

const graph: RelationshipGraphResponse = {
  root_member_id: 'member-child',
  depth: 2,
  nodes: [
    {
      id: 'member-child',
      display_name: 'Nguyễn Gia Bảo',
      familiar_name: 'Gia Bảo',
      hometown: null,
      birth_date: null,
      birth_year: 1996,
      deceased: false,
      version: 1,
      distance: 0,
    },
    {
      id: 'member-parent-b',
      display_name: 'Trần Thu Hà',
      familiar_name: 'Mẹ Hà',
      hometown: null,
      birth_date: null,
      birth_year: 1968,
      deceased: false,
      version: 1,
      distance: 1,
    },
    {
      id: 'member-parent-a',
      display_name: 'Nguyễn Minh Đức',
      familiar_name: 'Ba Đức',
      hometown: null,
      birth_date: null,
      birth_year: 1965,
      deceased: false,
      version: 1,
      distance: 1,
    },
    {
      id: 'member-orphan',
      display_name: 'Người chưa rõ nhánh',
      familiar_name: null,
      hometown: null,
      birth_date: null,
      birth_year: null,
      deceased: false,
      version: 1,
      distance: 2,
    },
  ],
  relationships: [
    {
      id: 'relationship-parent',
      from_member_id: 'member-parent-a',
      to_member_id: 'member-child',
      type: 'parent_child',
      subtype: 'biological',
      start_date: null,
      end_date: null,
      version: 1,
    },
    {
      id: 'relationship-partner',
      from_member_id: 'member-parent-a',
      to_member_id: 'member-parent-b',
      type: 'partnership',
      subtype: 'married',
      start_date: null,
      end_date: null,
      version: 1,
    },
  ],
};

describe('connected relationship tree model', () => {
  it('places parents above children and partners on the same deterministic row', () => {
    const rows = buildTreeRows(graph);

    expect(rows.map((row) => row.level)).toEqual([-1, 0]);
    expect(rows[0]?.members.map((member) => member.id)).toEqual([
      'member-parent-a',
      'member-parent-b',
    ]);
    expect(rows[1]?.members.map((member) => member.id)).toEqual(['member-child']);
    expect(rows.flatMap((row) => row.members).some((member) => member.id === 'member-orphan')).toBe(
      false,
    );
  });

  it('describes explicit biological, adoptive and partnership directions', () => {
    expect(connectionsFor(graph, 'member-child')).toEqual([
      expect.objectContaining({ member_id: 'member-parent-a', label: 'Cha / mẹ' }),
    ]);

    const adoptive: RelationshipGraphResponse = {
      ...graph,
      relationships: [
        { ...graph.relationships[0]!, subtype: 'adoptive' },
        graph.relationships[1]!,
      ],
    };
    expect(connectionsFor(adoptive, 'member-parent-a')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ member_id: 'member-child', label: 'Con nuôi' }),
        expect.objectContaining({ member_id: 'member-parent-b', label: 'Bạn đời' }),
      ]),
    );
  });

  it('builds create requests with the correct parent-child direction', () => {
    expect(
      relationshipProposal('selected', 'target', { kind: 'parent', subtype: 'biological' }),
    ).toEqual({
      type: 'relationship_create',
      payload: {
        from_member_id: 'target',
        to_member_id: 'selected',
        type: 'parent_child',
        subtype: 'biological',
      },
    });
    expect(
      relationshipProposal('selected', 'target', { kind: 'child', subtype: 'adoptive' }),
    ).toEqual({
      type: 'relationship_create',
      payload: {
        from_member_id: 'selected',
        to_member_id: 'target',
        type: 'parent_child',
        subtype: 'adoptive',
      },
    });
    expect(
      relationshipProposal('selected', 'target', { kind: 'partner', subtype: 'married' }),
    ).toEqual({
      type: 'relationship_create',
      payload: {
        from_member_id: 'selected',
        to_member_id: 'target',
        type: 'partnership',
        subtype: 'married',
      },
    });
  });
});
