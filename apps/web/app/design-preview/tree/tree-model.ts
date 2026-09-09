import {
  getPreviewMember,
  previewMembers,
  previewRelationships,
  type PreviewMember,
} from '../fixtures';

export type TreeConnection = {
  member: PreviewMember;
  label: string;
  kind: 'parent' | 'partner' | 'child' | 'adoptive-child';
};

export type TreeNodePosition = { x: number; y: number };

const connectedMemberIds = new Set(
  previewRelationships.flatMap((relationship) => [relationship.from, relationship.to]),
);

export const treeGenerations = [1, 2, 3].map((generation) => ({
  generation,
  members: previewMembers.filter(
    (member) => member.generation === generation && connectedMemberIds.has(member.id),
  ),
}));

export const treeCanvasSize = { width: 1080, height: 590 } as const;

export const treeNodePositions: Record<string, TreeNodePosition> = {
  'van-binh': { x: 480, y: 22 },
  'thi-mai': { x: 600, y: 22 },
  'minh-duc': { x: 110, y: 220 },
  'thu-ha': { x: 230, y: 220 },
  'thanh-huong': { x: 415, y: 220 },
  'quoc-an': { x: 535, y: 220 },
  'minh-son': { x: 720, y: 220 },
  'ngoc-lan': { x: 840, y: 220 },
  'gia-bao': { x: 70, y: 430 },
  'minh-anh': { x: 260, y: 430 },
  'hai-nam': { x: 405, y: 430 },
  'thao-chi': { x: 545, y: 430 },
  'tuan-khang': { x: 710, y: 430 },
  'ngoc-vy': { x: 875, y: 430 },
};

export function getTreeNodePosition(memberId: string) {
  const position = treeNodePositions[memberId];
  if (!position) throw new Error(`Missing preview tree position for ${memberId}`);
  return position;
}

export function getRelationshipPath(
  fromId: string,
  toId: string,
  kind: 'parent' | 'partner' | 'adoptive-parent',
) {
  const from = getTreeNodePosition(fromId);
  const to = getTreeNodePosition(toId);
  if (kind === 'partner') {
    const direction = Math.sign(to.x - from.x) || 1;
    return `M ${from.x + direction * 34} ${from.y + 28} L ${to.x - direction * 34} ${to.y + 28}`;
  }
  const startY = from.y + 58;
  const endY = to.y - 7;
  const middleY = Math.round(startY + (endY - startY) * 0.55);
  return `M ${from.x} ${startY} V ${middleY} H ${to.x} V ${endY}`;
}

export function getTreePerson(id: string | null) {
  return getPreviewMember(id);
}

export function getConnections(id: string): TreeConnection[] {
  return previewRelationships.flatMap<TreeConnection>((relationship) => {
    if (relationship.kind === 'partner') {
      if (relationship.from === id) {
        return [
          { member: getPreviewMember(relationship.to), label: 'Bạn đời', kind: 'partner' as const },
        ];
      }
      if (relationship.to === id) {
        return [
          {
            member: getPreviewMember(relationship.from),
            label: 'Bạn đời',
            kind: 'partner' as const,
          },
        ];
      }
      return [];
    }

    if (relationship.to === id) {
      return [
        {
          member: getPreviewMember(relationship.from),
          label: relationship.kind === 'adoptive-parent' ? 'Cha / mẹ nuôi' : 'Cha / mẹ',
          kind: 'parent' as const,
        },
      ];
    }

    if (relationship.from === id) {
      return [
        {
          member: getPreviewMember(relationship.to),
          label: relationship.kind === 'adoptive-parent' ? 'Con nuôi' : 'Con',
          kind:
            relationship.kind === 'adoptive-parent'
              ? ('adoptive-child' as const)
              : ('child' as const),
        },
      ];
    }

    return [];
  });
}
