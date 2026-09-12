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
});
