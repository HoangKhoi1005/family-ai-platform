'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  CreateRelationshipPayload,
  RelationshipChangeRequestDto,
  RelationshipChangeRequestListResponse,
} from '@family/contracts';
import { explain, request } from './api';
import type { Member } from './types';
import s from './connected.module.css';

export function RelationshipAdmin({
  base,
  members,
  onRefresh,
}: {
  base: string;
  members: Member[];
  onRefresh: () => Promise<void>;
}) {
  const [rows, setRows] = useState<RelationshipChangeRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await request<RelationshipChangeRequestListResponse>(
        `${base}/change-requests?status=pending`,
      );
      setRows(result.change_requests);
    } catch (error) {
      setError(explain(error));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    // The request owns this server state; there is no local derivation to keep in sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(row: RelationshipChangeRequestDto, decision: 'approved' | 'rejected') {
    setBusyId(row.id);
    setError('');
    setMessage('');
    try {
      await request(`${base}/change-requests/${row.id}/decision`, {
        decision,
        version: row.version,
      });
      setMessage(decision === 'approved' ? 'Đã duyệt quan hệ.' : 'Đã từ chối đề xuất quan hệ.');
      await load();
      await onRefresh();
    } catch (error) {
      setError(explain(error));
    } finally {
      setBusyId('');
    }
  }

  const names = new Map(members.map((member) => [member.id, member.display_name]));

  return (
    <section className={s.adminSection} aria-labelledby="relationship-admin-heading">
      <p className={s.eyebrow}>GIỮ CÂY GIA PHẢ CHÍNH XÁC</p>
      <h2 id="relationship-admin-heading">Duyệt thay đổi gia phả.</h2>
      <p>
        Đọc lại hai người và loại quan hệ trước khi quyết định. Cây chỉ đổi sau khi máy chủ xác
        nhận.
      </p>
      {message ? (
        <p className={s.success} role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <div className={s.error} role="alert">
          {error}
          <button type="button" onClick={() => void load()}>
            Thử lại phần gia phả
          </button>
        </div>
      ) : null}
      {loading ? (
        <p role="status">Đang kiểm tra các đề xuất…</p>
      ) : rows.length ? (
        <div>
          {rows.map((row) => {
            const summary = describeRequest(row, names);
            return (
              <article className={s.approvalRow} key={row.id}>
                <div>
                  <strong>{summary.title}</strong>
                  <p>{summary.detail}</p>
                  <small>Gửi lúc {formatDate(row.created_at)}</small>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => void decide(row, 'approved')}
                >
                  {busyId === row.id ? 'Đang xử lý…' : 'Duyệt quan hệ'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => void decide(row, 'rejected')}
                >
                  Từ chối
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p>Chưa có đề xuất quan hệ nào đang chờ.</p>
      )}
    </section>
  );
}

function describeRequest(row: RelationshipChangeRequestDto, names: Map<string, string>) {
  if (row.type !== 'relationship_create' || !isCreatePayload(row.payload)) {
    return {
      title:
        row.type === 'relationship_remove' ? 'Đề xuất gỡ một quan hệ' : 'Đề xuất sửa một quan hệ',
      detail: 'Quan hệ hiện tại cần được tải lại trước khi duyệt thay đổi này.',
    };
  }

  const from = names.get(row.payload.from_member_id) ?? 'Hồ sơ không còn trong danh bạ';
  const to = names.get(row.payload.to_member_id) ?? 'Hồ sơ không còn trong danh bạ';
  if (row.payload.type === 'partnership') {
    return {
      title: row.payload.subtype === 'married' ? 'Quan hệ hôn nhân' : 'Quan hệ bạn đời',
      detail: `${from} ↔ ${to}`,
    };
  }

  const title =
    row.payload.subtype === 'adoptive'
      ? 'Quan hệ cha / mẹ nuôi'
      : row.payload.subtype === 'biological'
        ? 'Quan hệ cha / mẹ'
        : 'Quan hệ cha / mẹ · chưa xác định loại';
  return { title, detail: `${from} là cha / mẹ của ${to}` };
}

function isCreatePayload(
  payload: RelationshipChangeRequestDto['payload'],
): payload is CreateRelationshipPayload {
  return Boolean(
    payload &&
    'from_member_id' in payload &&
    'to_member_id' in payload &&
    'type' in payload &&
    'subtype' in payload,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
