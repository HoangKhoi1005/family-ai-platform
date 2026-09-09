import type { PoolClient } from 'pg';
import type {
  CreateRelationshipChangeRequestInput,
  CreateRelationshipPayload,
  RelationshipChangeRequestDto,
  RelationshipChangeRequestListResponse,
  RelationshipDecisionInput,
  RelationshipSubtype,
  RelationshipType,
  UpdateRelationshipPayload,
} from '@family/contracts';
import { writeAudit, type AuditAction } from './audit.js';
import { FamilyHttpError, lockFamily, requireFamily, setRouteContext } from './authorization.js';

interface ChangeRequestRow {
  id: string;
  type: CreateRelationshipChangeRequestInput['type'];
  target_id: string | null;
  base_version: number | null;
  proposed_payload: CreateRelationshipPayload | UpdateRelationshipPayload | null;
  status: RelationshipChangeRequestDto['status'];
  actor_membership_id: string;
  reviewer_id: string | null;
  decision_note: string | null;
  decided_at: Date | string | null;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RelationshipRow {
  id: string;
  from_member_id: string;
  to_member_id: string;
  type: RelationshipType;
  subtype: RelationshipSubtype;
  start_date: string | null;
  end_date: string | null;
  version: number;
}

function conflict(message = 'Dữ liệu quan hệ đã thay đổi. Vui lòng tải lại.'): never {
  throw new FamilyHttpError(409, 'CONFLICT', message);
}

function invalid(message: string): never {
  throw new FamilyHttpError(400, 'VALIDATION_ERROR', message);
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function mapRequest(row: ChangeRequestRow): RelationshipChangeRequestDto {
  return {
    id: row.id,
    type: row.type,
    target_id: row.target_id,
    base_version: row.base_version,
    payload: row.proposed_payload,
    status: row.status,
    requested_by: row.actor_membership_id,
    reviewer_id: row.reviewer_id,
    decision_note: row.decision_note,
    decided_at: iso(row.decided_at),
    version: row.version,
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
  };
}

function normalizeDate(value: string | null | undefined, field: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(`${field} không hợp lệ.`);
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year!, month! - 1, day);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month! - 1 ||
    parsed.getUTCDate() !== day
  ) {
    invalid(`${field} không hợp lệ.`);
  }
  return value;
}

function normalizeCreatePayload(payload: CreateRelationshipPayload): CreateRelationshipPayload {
  if (payload.from_member_id === payload.to_member_id)
    invalid('Không thể nối một người với chính họ.');
  if (payload.type === 'parent_child') return { ...payload };
  const [fromMemberId, toMemberId] = [payload.from_member_id, payload.to_member_id].sort();
  const startDate = normalizeDate(payload.start_date, 'Ngày bắt đầu');
  const endDate = normalizeDate(payload.end_date, 'Ngày kết thúc');
  if (startDate && endDate && endDate < startDate)
    invalid('Ngày kết thúc không thể trước ngày bắt đầu.');
  return {
    from_member_id: fromMemberId!,
    to_member_id: toMemberId!,
    type: 'partnership',
    subtype: payload.subtype,
    start_date: startDate ?? null,
    end_date: endDate ?? null,
  };
}

function normalizeUpdatePayload(payload: UpdateRelationshipPayload): UpdateRelationshipPayload {
  const normalized: UpdateRelationshipPayload = {};
  if (payload.subtype !== undefined) normalized.subtype = payload.subtype;
  if (payload.start_date !== undefined)
    normalized.start_date = normalizeDate(payload.start_date, 'Ngày bắt đầu') ?? null;
  if (payload.end_date !== undefined)
    normalized.end_date = normalizeDate(payload.end_date, 'Ngày kết thúc') ?? null;
  if (Object.keys(normalized).length === 0) invalid('Cần có nội dung cập nhật.');
  return normalized;
}

function normalizeInput(
  input: CreateRelationshipChangeRequestInput,
): CreateRelationshipChangeRequestInput {
  if (input.type === 'relationship_create') {
    return { type: input.type, payload: normalizeCreatePayload(input.payload) };
  }
  if (!Number.isInteger(input.base_version) || input.base_version < 1)
    invalid('Phiên bản không hợp lệ.');
  if (input.type === 'relationship_remove') return { ...input };
  return { ...input, payload: normalizeUpdatePayload(input.payload) };
}

async function requireMembers(
  client: PoolClient,
  familyId: string,
  fromMemberId: string,
  toMemberId: string,
): Promise<void> {
  const members = await client.query(
    `SELECT id FROM members WHERE family_id=$1 AND id = ANY($2::uuid[])`,
    [familyId, [fromMemberId, toMemberId]],
  );
  if (members.rowCount !== 2) {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy người thân trong nhà này.');
  }
}

async function requireRelationship(
  client: PoolClient,
  familyId: string,
  relationshipId: string,
  forUpdate = false,
): Promise<RelationshipRow> {
  const relationship = await client.query<RelationshipRow>(
    `SELECT id,from_member_id,to_member_id,type,subtype,start_date::text,end_date::text,version
       FROM relationships
      WHERE family_id=$1 AND id=$2 AND removed_at IS NULL${forUpdate ? ' FOR UPDATE' : ''}`,
    [familyId, relationshipId],
  );
  const row = relationship.rows[0];
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy quan hệ.');
  return row;
}

async function assertNoDuplicate(
  client: PoolClient,
  familyId: string,
  payload: CreateRelationshipPayload,
): Promise<void> {
  const duplicate = await client.query(
    `SELECT 1 FROM relationships
      WHERE family_id=$1 AND from_member_id=$2 AND to_member_id=$3
        AND type=$4 AND removed_at IS NULL
        AND ($4 <> 'partnership' OR end_date IS NULL)
      LIMIT 1`,
    [familyId, payload.from_member_id, payload.to_member_id, payload.type],
  );
  if (duplicate.rowCount) conflict('Quan hệ này đã tồn tại.');
}

async function assertNoParentCycle(
  client: PoolClient,
  familyId: string,
  payload: CreateRelationshipPayload,
): Promise<void> {
  if (payload.type !== 'parent_child') return;
  const cycle = await client.query(
    `WITH RECURSIVE descendants(member_id) AS (
       SELECT to_member_id FROM relationships
        WHERE family_id=$1 AND from_member_id=$2 AND type='parent_child' AND removed_at IS NULL
       UNION
       SELECT relationship.to_member_id
         FROM descendants
         JOIN relationships relationship
           ON relationship.family_id=$1
          AND relationship.from_member_id=descendants.member_id
          AND relationship.type='parent_child'
          AND relationship.removed_at IS NULL
     )
     SELECT 1 FROM descendants WHERE member_id=$3 LIMIT 1`,
    [familyId, payload.to_member_id, payload.from_member_id],
  );
  if (cycle.rowCount) conflict('Quan hệ này sẽ tạo chu trình tổ tiên.');
}

async function validateCreate(
  client: PoolClient,
  familyId: string,
  payload: CreateRelationshipPayload,
): Promise<void> {
  await requireMembers(client, familyId, payload.from_member_id, payload.to_member_id);
  await assertNoDuplicate(client, familyId, payload);
  await assertNoParentCycle(client, familyId, payload);
}

async function validateUpdate(
  relationship: RelationshipRow,
  payload: UpdateRelationshipPayload,
): Promise<{ subtype: RelationshipSubtype; startDate: string | null; endDate: string | null }> {
  if (relationship.type === 'parent_child') {
    if (payload.start_date !== undefined || payload.end_date !== undefined) {
      invalid('Quan hệ cha mẹ - con không dùng ngày bắt đầu hoặc kết thúc.');
    }
    const subtype = payload.subtype ?? relationship.subtype;
    if (!['biological', 'adoptive', 'unspecified'].includes(subtype)) {
      invalid('Loại quan hệ cha mẹ - con không hợp lệ.');
    }
    return { subtype, startDate: null, endDate: null };
  }
  const subtype = payload.subtype ?? relationship.subtype;
  if (!['married', 'partner'].includes(subtype)) invalid('Loại quan hệ bạn đời không hợp lệ.');
  const startDate = payload.start_date === undefined ? relationship.start_date : payload.start_date;
  const endDate = payload.end_date === undefined ? relationship.end_date : payload.end_date;
  if (startDate && endDate && endDate < startDate)
    invalid('Ngày kết thúc không thể trước ngày bắt đầu.');
  return { subtype, startDate, endDate };
}

const requestColumns = `id,type,target_id,base_version,proposed_payload,status,
  actor_membership_id,reviewer_id,decision_note,decided_at,version,created_at,updated_at`;

export async function createRelationshipChangeRequest(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    request: CreateRelationshipChangeRequestInput;
  },
): Promise<RelationshipChangeRequestDto> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const normalized = normalizeInput(input.request);
  if (normalized.type === 'relationship_create') {
    await validateCreate(client, input.familyId, normalized.payload);
  } else {
    const relationship = await requireRelationship(client, input.familyId, normalized.target_id);
    if (relationship.version !== normalized.base_version) conflict();
    if (normalized.type === 'relationship_update') {
      await validateUpdate(relationship, normalized.payload);
    }
  }
  const payload = normalized.type === 'relationship_remove' ? null : normalized.payload;
  const created = await client.query<ChangeRequestRow>(
    `INSERT INTO change_requests
       (family_id,actor_membership_id,type,target_id,base_version,proposed_payload)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     RETURNING ${requestColumns}`,
    [
      input.familyId,
      membership.id,
      normalized.type,
      normalized.type === 'relationship_create' ? null : normalized.target_id,
      normalized.type === 'relationship_create' ? null : normalized.base_version,
      payload === null ? null : JSON.stringify(payload),
    ],
  );
  const row = created.rows[0]!;
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'relationship.change_requested',
    targetType: 'change_request',
    targetId: row.id,
    changeSummary: normalized.type,
  });
  return mapRequest(row);
}

export async function listPendingRelationshipChangeRequests(
  client: PoolClient,
  input: { familyId: string; actorId: string },
): Promise<RelationshipChangeRequestListResponse> {
  await requireFamily(client, input.actorId, input.familyId, true);
  const rows = await client.query<ChangeRequestRow>(
    `SELECT ${requestColumns} FROM change_requests
      WHERE family_id=$1 AND status='pending' ORDER BY created_at,id`,
    [input.familyId],
  );
  return { change_requests: rows.rows.map(mapRequest) };
}

export async function cancelRelationshipChangeRequest(
  client: PoolClient,
  input: { familyId: string; actorId: string; requestId: string; version: number },
): Promise<RelationshipChangeRequestDto> {
  await requireFamily(client, input.actorId, input.familyId);
  const existing = await client.query<ChangeRequestRow>(
    `SELECT ${requestColumns} FROM change_requests WHERE family_id=$1 AND id=$2`,
    [input.familyId, input.requestId],
  );
  const row = existing.rows[0];
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy đề xuất.');
  if (row.status !== 'pending' || row.version !== input.version) conflict();
  await setRouteContext(client, { purpose: 'relationship_cancel', requestId: input.requestId });
  const cancelled = await client.query<ChangeRequestRow>(
    `UPDATE change_requests
        SET status='cancelled',decided_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
      WHERE family_id=$1 AND id=$2 AND status='pending' AND version=$3
      RETURNING ${requestColumns}`,
    [input.familyId, input.requestId, input.version],
  );
  if (!cancelled.rows[0]) conflict();
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'relationship.change_cancelled',
    targetType: 'change_request',
    targetId: input.requestId,
    changeSummary: row.type,
    version: input.version + 1,
  });
  return mapRequest(cancelled.rows[0]);
}

async function applyApprovedRequest(
  client: PoolClient,
  familyId: string,
  request: ChangeRequestRow,
): Promise<{ id: string; action: AuditAction; version: number }> {
  if (request.type === 'relationship_create') {
    const payload = normalizeCreatePayload(request.proposed_payload as CreateRelationshipPayload);
    await validateCreate(client, familyId, payload);
    const inserted = await client.query<{ id: string; version: number }>(
      `INSERT INTO relationships
         (family_id,from_member_id,to_member_id,type,subtype,start_date,end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,version`,
      [
        familyId,
        payload.from_member_id,
        payload.to_member_id,
        payload.type,
        payload.subtype,
        payload.type === 'partnership' ? (payload.start_date ?? null) : null,
        payload.type === 'partnership' ? (payload.end_date ?? null) : null,
      ],
    );
    return { id: inserted.rows[0]!.id, action: 'relationship.created', version: 1 };
  }

  const relationship = await requireRelationship(client, familyId, request.target_id!, true);
  if (relationship.version !== request.base_version) conflict();
  if (request.type === 'relationship_remove') {
    const removed = await client.query<{ version: number }>(
      `UPDATE relationships SET removed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
        WHERE family_id=$1 AND id=$2 AND removed_at IS NULL AND version=$3 RETURNING version`,
      [familyId, relationship.id, relationship.version],
    );
    if (!removed.rows[0]) conflict();
    return {
      id: relationship.id,
      action: 'relationship.removed',
      version: removed.rows[0].version,
    };
  }

  const values = await validateUpdate(
    relationship,
    request.proposed_payload as UpdateRelationshipPayload,
  );
  const updated = await client.query<{ version: number }>(
    `UPDATE relationships
        SET subtype=$4,start_date=$5,end_date=$6,version=version+1,updated_at=clock_timestamp()
      WHERE family_id=$1 AND id=$2 AND removed_at IS NULL AND version=$3 RETURNING version`,
    [
      familyId,
      relationship.id,
      relationship.version,
      values.subtype,
      values.startDate,
      values.endDate,
    ],
  );
  if (!updated.rows[0]) conflict();
  return { id: relationship.id, action: 'relationship.updated', version: updated.rows[0].version };
}

export async function decideRelationshipChangeRequest(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    requestId: string;
    decision: RelationshipDecisionInput;
  },
): Promise<RelationshipChangeRequestDto> {
  const reviewer = await requireFamily(client, input.actorId, input.familyId, true);
  await lockFamily(client, input.familyId);
  await setRouteContext(client, { purpose: 'relationship_decision', requestId: input.requestId });
  const selected = await client.query<ChangeRequestRow>(
    `SELECT ${requestColumns} FROM change_requests WHERE family_id=$1 AND id=$2 FOR UPDATE`,
    [input.familyId, input.requestId],
  );
  const request = selected.rows[0];
  if (!request) throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy đề xuất.');
  if (request.status !== 'pending' || request.version !== input.decision.version) conflict();

  let applied: { id: string; action: AuditAction; version: number } | undefined;
  if (input.decision.decision === 'approved') {
    applied = await applyApprovedRequest(client, input.familyId, request);
    await writeAudit(client, {
      familyId: input.familyId,
      actorId: input.actorId,
      action: applied.action,
      targetType: 'relationship',
      targetId: applied.id,
      changeSummary: request.type,
      version: applied.version,
    });
  }

  const status = input.decision.decision;
  const note = input.decision.note?.trim() || null;
  const decided = await client.query<ChangeRequestRow>(
    `UPDATE change_requests
        SET status=$4,reviewer_id=$5,decision_note=$6,decided_at=clock_timestamp(),
            version=version+1,updated_at=clock_timestamp()
      WHERE family_id=$1 AND id=$2 AND status='pending' AND version=$3
      RETURNING ${requestColumns}`,
    [input.familyId, input.requestId, input.decision.version, status, reviewer.id, note],
  );
  if (!decided.rows[0]) conflict();
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: status === 'approved' ? 'relationship.change_approved' : 'relationship.change_rejected',
    targetType: 'change_request',
    targetId: input.requestId,
    changeSummary: request.type,
    version: input.decision.version + 1,
  });
  return mapRequest(decided.rows[0]);
}
