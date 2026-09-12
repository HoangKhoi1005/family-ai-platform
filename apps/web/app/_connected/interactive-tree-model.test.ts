import { describe, expect, it } from 'vitest';
import type { RelationshipGraphResponse } from '@family/contracts';
import { buildInteractiveTreeLayout } from './interactive-tree-model';

const graph: RelationshipGraphResponse = {
  root_member_id: 'root',
  depth: 2,
  nodes: [
    {
      id: 'root',
      display_name: 'Nguyễn Gia Bảo',
      familiar_name: 'Gia Bảo',
      hometown: 'Cà Mau',
      birth_date: null,
      birth_year: 1996,
      deceased: false,
      version: 1,
      distance: 0,
    },
    {
      id: 'parent',
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
      id: 'grandparent',
      display_name: 'Nguyễn Văn Minh',
      familiar_name: 'Ông Minh',
      hometown: null,
      birth_date: null,
      birth_year: 1938,
      deceased: true,
      version: 1,
      distance: 2,
    },
    {
      id: 'child',
      display_name: 'Nguyễn Minh Khang',
      familiar_name: 'Khang',
      hometown: null,
      birth_date: null,
      birth_year: 2021,
      deceased: false,
      version: 1,
      distance: 1,
    },
  ],
  relationships: [
    {
      id: 'grandparent-parent',
      from_member_id: 'grandparent',
      to_member_id: 'parent',
      type: 'parent_child',
      subtype: 'biological',
      start_date: null,
      end_date: null,
      version: 1,
    },
    {
      id: 'parent-root',
      from_member_id: 'parent',
      to_member_id: 'root',
      type: 'parent_child',
      subtype: 'biological',
      start_date: null,
      end_date: null,
      version: 1,
    },
    {
      id: 'root-child',
      from_member_id: 'root',
      to_member_id: 'child',
      type: 'parent_child',
      subtype: 'adoptive',
      start_date: null,
      end_date: null,
      version: 1,
    },
  ],
};

describe('interactive family tree layout', () => {
  it('places approved members in deterministic generation order', () => {
    const layout = buildInteractiveTreeLayout(graph, new Set());

    expect(layout.nodes.map((node) => node.id)).toEqual(['grandparent', 'parent', 'root', 'child']);
    expect(layout.nodes.map((node) => node.position.y)).toEqual([-440, -220, 0, 220]);
    expect(layout.nodes.find((node) => node.id === 'root')).toMatchObject({
      isRoot: true,
      position: { x: -74, y: 0 },
    });
  });

  it('creates exactly one renderer seed for every visible approved relationship', () => {
    const layout = buildInteractiveTreeLayout(graph, new Set());

    expect(layout.edges).toEqual([
      expect.objectContaining({
        id: 'grandparent-parent',
        source: 'grandparent',
        target: 'parent',
        kind: 'parent_child',
      }),
      expect.objectContaining({
        id: 'parent-root',
        source: 'parent',
        target: 'root',
        kind: 'parent_child',
      }),
      expect.objectContaining({
        id: 'root-child',
        source: 'root',
        target: 'child',
        kind: 'parent_child',
      }),
    ]);
  });

  it('collapses only neighbors farther from the current root', () => {
    const layout = buildInteractiveTreeLayout(graph, new Set(['parent']));

    expect(layout.nodes.map((node) => node.id)).toEqual(['parent', 'root', 'child']);
    expect(layout.nodes.find((node) => node.id === 'parent')).toMatchObject({
      collapsed: true,
      hasBranch: true,
    });
    expect(layout.edges.map((edge) => edge.id)).toEqual(['parent-root', 'root-child']);
  });

  it('does not mutate the approved graph while deriving local visibility', () => {
    const before = structuredClone(graph);

    buildInteractiveTreeLayout(graph, new Set(['root']));

    expect(graph).toEqual(before);
  });

  it('keeps active partners together and centers their child below the pair', () => {
    const family: RelationshipGraphResponse = {
      root_member_id: 'child',
      depth: 2,
      nodes: [
        { ...graph.nodes[0]!, id: 'child', display_name: 'Con' },
        { ...graph.nodes[1]!, id: 'mother', display_name: 'Mẹ' },
        { ...graph.nodes[1]!, id: 'father', display_name: 'Cha' },
      ],
      relationships: [
        {
          id: 'parents',
          from_member_id: 'father',
          to_member_id: 'mother',
          type: 'partnership',
          subtype: 'married',
          start_date: null,
          end_date: null,
          version: 1,
        },
        {
          id: 'father-child',
          from_member_id: 'father',
          to_member_id: 'child',
          type: 'parent_child',
          subtype: 'biological',
          start_date: null,
          end_date: null,
          version: 1,
        },
        {
          id: 'mother-child',
          from_member_id: 'mother',
          to_member_id: 'child',
          type: 'parent_child',
          subtype: 'biological',
          start_date: null,
          end_date: null,
          version: 1,
        },
      ],
    };
    const layout = buildInteractiveTreeLayout(family, new Set());
    const positions = new Map(layout.nodes.map((node) => [node.id, node.position]));
    const father = positions.get('father')!;
    const mother = positions.get('mother')!;
    const child = positions.get('child')!;

    expect(Math.abs(father.x - mother.x)).toBeLessThan(190);
    expect(child.x + 74).toBe((father.x + mother.x) / 2 + 74);
    expect(child.y).toBeGreaterThan(father.y);
  });

  it('does not cluster a historical partner into the active couple', () => {
    const family: RelationshipGraphResponse = {
      root_member_id: 'person',
      depth: 2,
      nodes: [
        { ...graph.nodes[0]!, id: 'person', display_name: 'Một người có tên rất dài' },
        { ...graph.nodes[0]!, id: 'active', display_name: 'Bạn đời hiện tại' },
        { ...graph.nodes[0]!, id: 'former', display_name: 'Bạn đời trước' },
      ],
      relationships: [
        {
          id: 'active-partner',
          from_member_id: 'active',
          to_member_id: 'person',
          type: 'partnership',
          subtype: 'married',
          start_date: null,
          end_date: null,
          version: 1,
        },
        {
          id: 'former-partner',
          from_member_id: 'former',
          to_member_id: 'person',
          type: 'partnership',
          subtype: 'married',
          start_date: '2000-01-01',
          end_date: '2010-01-01',
          version: 1,
        },
      ],
    };
    const layout = buildInteractiveTreeLayout(family, new Set());
    const positions = new Map(layout.nodes.map((node) => [node.id, node.position.x]));

    expect(Math.abs(positions.get('active')! - positions.get('person')!)).toBeLessThan(190);
    expect(Math.abs(positions.get('former')! - positions.get('person')!)).toBeGreaterThanOrEqual(
      190,
    );
  });

  it('packs a dense generation without overlapping nodes', () => {
    const children = Array.from({ length: 8 }, (_, index) => ({
      ...graph.nodes[3]!,
      id: `child-${index}`,
      display_name: `Nguyễn Một Tên Rất Dài Số ${index}`,
    }));
    const dense: RelationshipGraphResponse = {
      root_member_id: 'root',
      depth: 2,
      nodes: [{ ...graph.nodes[0]!, id: 'root' }, ...children],
      relationships: children.map((child, index) => ({
        id: `edge-${index}`,
        from_member_id: 'root',
        to_member_id: child.id,
        type: 'parent_child' as const,
        subtype: index === 0 ? ('adoptive' as const) : ('unspecified' as const),
        start_date: null,
        end_date: null,
        version: 1,
      })),
    };
    const row = buildInteractiveTreeLayout(dense, new Set())
      .nodes.filter((node) => node.position.y === 220)
      .sort((left, right) => left.position.x - right.position.x);

    expect(row).toHaveLength(8);
    for (let index = 1; index < row.length; index += 1) {
      expect(row[index]!.position.x - row[index - 1]!.position.x).toBeGreaterThanOrEqual(190);
    }
  });
});
