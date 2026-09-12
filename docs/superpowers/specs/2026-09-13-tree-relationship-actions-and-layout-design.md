# Tree Relationship Actions and Family Layout Design

**Date:** 2026-09-13
**Status:** Approved for implementation by the project owner

## Goal

Complete the mobile family-tree workflow from a selected person: add an existing or new relative, review the proposal, let an administrator approve it, update or remove an existing relationship, cancel a pending proposal, and refresh the approved graph. Improve the initial layout so current partners form a visual unit and children sit beneath their known parent unit.

## Product flow

Selecting a node opens the existing member sheet. The primary action becomes **Thêm người thân** and uses three short stages:

1. Choose the relationship from the selected person: parent, child, spouse, or partner, including biological/adoptive/unspecified subtype where applicable.
2. Choose an existing Member or enter a minimal new-person draft.
3. Review both names and the explicit direction of the relationship, then submit.

An existing Member produces `relationship_create`. A new-person draft produces `member_create`, whose payload contains the minimal Member fields and an anchor-relative relationship description. Contact details are deliberately excluded; after approval, an administrator may enrich the unlinked profile through the existing managed-profile flow.

Every confirmed relationship in the member sheet exposes **Đề xuất sửa** and **Đề xuất gỡ**. Editing is type-specific: parent-child changes only its subtype; partnership changes subtype and optional start/end dates. Removal requires an explicit review step. Neither operation mutates the graph before approval.

The sheet also lists the current actor's pending proposals with a **Hủy đề xuất** action. Cancelled, rejected, and approved requests are not shown in this compact list.

## Contract and persistence

`change_requests` gains a `member_create` type. Its payload is:

```ts
{
  member: {
    display_name: string;
    familiar_name?: string | null;
    hometown?: string | null;
    birth_year?: number | null;
    deceased?: boolean;
  };
  relationship: {
    anchor_member_id: string;
    kind: 'parent' | 'child' | 'partner';
    subtype: ParentChildSubtype | PartnershipSubtype;
  };
}
```

Migration `0011` extends the type and shape constraints without weakening tenant foreign keys or RLS. Approval holds the family advisory lock, creates the unlinked Member and approved Relationship in the same transaction, records audit entries, then finalizes the request. Any validation or write failure rolls back both records.

`GET /change-requests` gains `scope=all|mine`. `all` remains admin-only and is the default for compatibility. `mine` requires an active membership and filters by the actor's membership ID. Cancellation remains restricted by server checks and RLS to the requester.

## Refresh behavior

After submitting or cancelling, the sheet reloads the actor's pending proposals. After an admin approves a request, the family directory and graph revision increase. A mounted tree reloads its approved graph; another open client receives the existing focus/15-second revalidation behavior. Pending proposals never appear as approved edges.

## Family layout

The layout stays deterministic and local. It does not infer kinship or persist coordinates.

- Current partnership edges (`end_date = null`) form same-generation partner units with a compact internal gap.
- Historical partnerships remain separate units connected by the existing historical edge style, so remarriage history remains visible without presenting former partners as a current household.
- A child unit's preferred center is the midpoint of its known parent units in the row above. Siblings with the same parent signature remain adjacent.
- Units are packed left-to-right with minimum spacing and no node overlap. Very long names wrap inside the existing fixed-width node.
- Parent-child subtype remains represented on the edge and textual ledger. Missing gender never becomes a guessed mother/father label.

The algorithm is intentionally sized for the 15-person pilot and bounded graph response. Dagre/ELK and persisted shared layout remain deferred until larger-family evidence justifies them.

## Permissions and privacy

- Active members can propose and cancel their own pending requests.
- Only active admins can list all requests or approve/reject.
- New-person proposals contain no phone, email, Facebook URL, biography, or precise address.
- All IDs are resolved inside the authenticated `family_id`; the server never trusts a client family scope.
- Member and Relationship remain separate records. Node movement and position never create or edit a relationship.

## Error handling

Validation, stale versions, duplicates, ancestry cycles, revoked membership, and network failures stay visible inside the active sheet or admin row. A stale approval returns conflict and reloads the relevant list. If approval of `member_create` fails at any point, no orphan Member remains.

## Verification

- Contract tests reject wrong payload/type combinations and unknown fields.
- Migration/database tests cover the new constraint shape and RLS.
- Integration tests cover member proposal creation, cross-family anchor denial, atomic approval, rejection, own-list isolation, cancellation ownership, and rollback without orphan records.
- Model tests cover active partner grouping, children under a parent unit, historical partnership separation, adoptive/unspecified edges, deterministic positions, and no overlap on a denser fixture.
- Browser tests cover the three-stage add flow, edit/remove review, cancel, admin approval with resolved names, graph reload, 320/390px layout, keyboard focus, and long Vietnamese names.

## Deferred

Member update proposals, deleting Member records, contact entry during proposal, drag-to-connect, persisted layouts, Household/Branch tables, and unbounded graph loading remain outside this slice.
