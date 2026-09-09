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

export const treeGenerations = [1, 2, 3].map((generation) => ({
  generation,
  members: previewMembers.filter((member) => member.generation === generation),
}));

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
