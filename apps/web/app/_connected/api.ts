import type {
  CancelEventInput,
  CreateEventInput,
  EventDetailResponse,
  EventOccurrenceListResponse,
  EventRsvpDto,
  UpdateEventInput,
  UpsertEventRsvpInput,
  NotificationListResponse,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesInput,
  AddMemoryItemInput,
  CreateMediaUploadInput,
  CreateMemoryFromMomentInput,
  CreateMemoryInput,
  CreateMomentInput,
  MediaAssetDto,
  MediaUploadGrantResponse,
  MemoryDto,
  MemoryListResponse,
  MomentDto,
  MomentListResponse,
  UpdateMomentReactionInput,
} from '@family/contracts';

export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}
export async function request<T>(
  path: string,
  body?: unknown,
  method = 'POST',
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 15000);
  try {
    const headers = {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      ...(Object.keys(headers).length === 0 ? {} : { headers }),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new RequestError(response.status, data?.error?.code ?? data?.code ?? 'REQUEST_FAILED');
    return data as T;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    if (timedOut) throw new RequestError(0, 'REQUEST_TIMEOUT');
    if (controller.signal.aborted) throw new RequestError(0, 'REQUEST_ABORTED');
    throw new RequestError(0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

type CalendarRequestOptions = Pick<RequestOptions, 'signal' | 'timeoutMs'>;

function familyCalendarBase(familyId: string) {
  return `/api/v1/families/${encodeURIComponent(familyId)}`;
}

export function listFamilyOccurrences(
  familyId: string,
  query: { from: string; to: string; cursor?: string; limit?: number },
  options: CalendarRequestOptions = {},
) {
  const search = new URLSearchParams({ from: query.from, to: query.to });
  if (query.cursor !== undefined) search.set('cursor', query.cursor);
  if (query.limit !== undefined) search.set('limit', String(query.limit));
  return request<EventOccurrenceListResponse>(
    `${familyCalendarBase(familyId)}/events?${search.toString()}`,
    undefined,
    'GET',
    options,
  );
}

export function getFamilyEvent(
  familyId: string,
  eventId: string,
  options: CalendarRequestOptions = {},
) {
  return request<EventDetailResponse>(
    `${familyCalendarBase(familyId)}/events/${encodeURIComponent(eventId)}`,
    undefined,
    'GET',
    options,
  );
}

export function createFamilyEvent(
  familyId: string,
  event: CreateEventInput,
  idempotencyKey: string,
  options: CalendarRequestOptions = {},
) {
  return request<EventDetailResponse>(`${familyCalendarBase(familyId)}/events`, event, 'POST', {
    ...options,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export function updateFamilyEvent(
  familyId: string,
  eventId: string,
  input: UpdateEventInput,
  options: CalendarRequestOptions = {},
) {
  return request<EventDetailResponse>(
    `${familyCalendarBase(familyId)}/events/${encodeURIComponent(eventId)}`,
    input,
    'PATCH',
    options,
  );
}

export function cancelFamilyEvent(
  familyId: string,
  eventId: string,
  input: CancelEventInput,
  options: CalendarRequestOptions = {},
) {
  return request<EventDetailResponse>(
    `${familyCalendarBase(familyId)}/events/${encodeURIComponent(eventId)}/cancel`,
    input,
    'POST',
    options,
  );
}

export function upsertFamilyOccurrenceRsvp(
  familyId: string,
  occurrenceId: string,
  input: UpsertEventRsvpInput,
  options: CalendarRequestOptions = {},
) {
  return request<EventRsvpDto>(
    `${familyCalendarBase(familyId)}/occurrences/${encodeURIComponent(occurrenceId)}/rsvp`,
    input,
    'PUT',
    options,
  );
}

export function listFamilyNotifications(
  familyId: string,
  query: { cursor?: string; limit?: number; unreadOnly?: boolean } = {},
  options: CalendarRequestOptions = {},
) {
  const search = new URLSearchParams();
  if (query.cursor !== undefined) search.set('cursor', query.cursor);
  if (query.limit !== undefined) search.set('limit', String(query.limit));
  if (query.unreadOnly !== undefined) search.set('unread_only', String(query.unreadOnly));
  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  return request<NotificationListResponse>(
    `${familyCalendarBase(familyId)}/notifications${suffix}`,
    undefined,
    'GET',
    options,
  );
}

export function markFamilyNotificationRead(
  familyId: string,
  notificationId: string,
  options: CalendarRequestOptions = {},
) {
  return request<{ id: string; read_at: string }>(
    `${familyCalendarBase(familyId)}/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
    'POST',
    options,
  );
}

export function getFamilyNotificationPreferences(
  familyId: string,
  options: CalendarRequestOptions = {},
) {
  return request<NotificationPreferencesDto>(
    `${familyCalendarBase(familyId)}/notification-preferences`,
    undefined,
    'GET',
    options,
  );
}

export function updateFamilyNotificationPreferences(
  familyId: string,
  input: UpdateNotificationPreferencesInput,
  options: CalendarRequestOptions = {},
) {
  return request<NotificationPreferencesDto>(
    `${familyCalendarBase(familyId)}/notification-preferences`,
    input,
    'PATCH',
    options,
  );
}

export function listFamilyMoments(
  familyId: string,
  query: { cursor?: string; limit?: number } = {},
  options: CalendarRequestOptions = {},
) {
  const search = new URLSearchParams();
  if (query.cursor) search.set('cursor', query.cursor);
  if (query.limit) search.set('limit', String(query.limit));
  const suffix = search.size ? `?${search.toString()}` : '';
  return request<MomentListResponse>(
    `${familyCalendarBase(familyId)}/moments${suffix}`,
    undefined,
    'GET',
    options,
  );
}

export function createFamilyMediaUpload(
  familyId: string,
  input: CreateMediaUploadInput,
  options: CalendarRequestOptions = {},
) {
  return request<MediaUploadGrantResponse>(
    `${familyCalendarBase(familyId)}/media/uploads`,
    input,
    'POST',
    options,
  );
}

export async function uploadFamilyMedia(
  grant: MediaUploadGrantResponse['upload'],
  file: File,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(grant.url, {
      method: grant.method,
      headers: grant.headers,
      body: file,
      ...(signal ? { signal } : {}),
    });
  } catch {
    if (signal?.aborted) throw new RequestError(0, 'REQUEST_ABORTED');
    throw new RequestError(0, 'NETWORK_ERROR');
  }
  if (!response.ok) throw new RequestError(response.status, 'UPLOAD_FAILED');
}

export function completeFamilyMediaUpload(
  familyId: string,
  mediaId: string,
  options: CalendarRequestOptions = {},
) {
  return request<MediaAssetDto>(
    `${familyCalendarBase(familyId)}/media/${encodeURIComponent(mediaId)}/complete`,
    {},
    'POST',
    options,
  );
}

export function getFamilyMedia(
  familyId: string,
  mediaId: string,
  options: CalendarRequestOptions = {},
) {
  return request<MediaAssetDto>(
    `${familyCalendarBase(familyId)}/media/${encodeURIComponent(mediaId)}`,
    undefined,
    'GET',
    options,
  );
}

export function familyMediaContentUrl(familyId: string, mediaId: string): string {
  return `${familyCalendarBase(familyId)}/media/${encodeURIComponent(mediaId)}/content`;
}

export function createFamilyMoment(
  familyId: string,
  input: CreateMomentInput,
  idempotencyKey: string,
  options: CalendarRequestOptions = {},
) {
  return request<MomentDto>(`${familyCalendarBase(familyId)}/moments`, input, 'POST', {
    ...options,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export function setFamilyMomentReaction(
  familyId: string,
  momentId: string,
  input: UpdateMomentReactionInput,
  options: CalendarRequestOptions = {},
) {
  return request<{ reaction: 'thuong' | null }>(
    `${familyCalendarBase(familyId)}/moments/${encodeURIComponent(momentId)}/reaction`,
    input,
    'PUT',
    options,
  );
}

export function deleteFamilyMoment(
  familyId: string,
  momentId: string,
  options: CalendarRequestOptions = {},
) {
  return request<void>(
    `${familyCalendarBase(familyId)}/moments/${encodeURIComponent(momentId)}`,
    {},
    'DELETE',
    options,
  );
}

export function listFamilyMemories(
  familyId: string,
  query: { cursor?: string; limit?: number } = {},
  options: CalendarRequestOptions = {},
) {
  const search = new URLSearchParams();
  if (query.cursor) search.set('cursor', query.cursor);
  if (query.limit) search.set('limit', String(query.limit));
  const suffix = search.size ? `?${search.toString()}` : '';
  return request<MemoryListResponse>(
    `${familyCalendarBase(familyId)}/memories${suffix}`,
    undefined,
    'GET',
    options,
  );
}

export function createFamilyMemory(
  familyId: string,
  input: CreateMemoryInput,
  options: CalendarRequestOptions = {},
) {
  return request<MemoryDto>(`${familyCalendarBase(familyId)}/memories`, input, 'POST', options);
}

export function preserveFamilyMoment(
  familyId: string,
  momentId: string,
  input: CreateMemoryFromMomentInput = {},
  options: CalendarRequestOptions = {},
) {
  return request<MemoryDto>(
    `${familyCalendarBase(familyId)}/moments/${encodeURIComponent(momentId)}/memory`,
    input,
    'POST',
    options,
  );
}

export function addFamilyMemoryItem(
  familyId: string,
  memoryId: string,
  input: AddMemoryItemInput,
  options: CalendarRequestOptions = {},
) {
  return request<MemoryDto>(
    `${familyCalendarBase(familyId)}/memories/${encodeURIComponent(memoryId)}/items`,
    input,
    'POST',
    options,
  );
}

export function explain(error: unknown): string {
  if (!(error instanceof RequestError)) return 'Chưa kết nối được. Kiểm tra mạng và thử lại nhé.';
  if (error.code === 'REQUEST_TIMEOUT') return 'Kết nối mất quá lâu. Kiểm tra mạng và thử lại nhé.';
  if (error.code === 'NETWORK_ERROR') return 'Chưa kết nối được. Kiểm tra mạng và thử lại nhé.';
  if (error.code === 'REQUEST_ABORTED') return 'Yêu cầu đã được dừng. Vui lòng thử lại.';
  if (error.code === 'CALENDAR_UNAVAILABLE')
    return 'Chưa thể xác nhận ngày này. Kiểm tra lại ngày và thử sau nhé.';
  if (error.code === 'EMAIL_NOT_VERIFIED')
    return 'Email chưa được xác minh. Mở thư xác minh hoặc gửi lại thư bên dưới.';
  if (error.status === 401)
    return 'Email hoặc mật khẩu chưa đúng, hoặc phiên đăng nhập đã hết hạn.';
  if (error.status === 403)
    return 'Bạn chưa có quyền thực hiện việc này. Vui lòng kiểm tra trạng thái vào nhà.';
  if (error.status === 409)
    return 'Thông tin đã thay đổi hoặc hồ sơ đã được nhận. Tải lại trước khi tiếp tục.';
  if (error.status === 429) return 'Bạn đã thử nhiều lần. Chờ một phút rồi thử lại nhé.';
  if (error.status === 404) return 'Không tìm thấy thông tin này hoặc bạn không còn quyền xem.';
  if (error.status >= 500) return 'Nhà mình đang gặp lỗi kết nối. Vui lòng thử lại sau.';
  return 'Thông tin chưa hợp lệ hoặc liên kết đã hết hạn. Kiểm tra lại và thử lại nhé.';
}
const inviteKey = 'family.pending-invitation';
const invitationTokenPattern = /^[A-Za-z0-9_-]+$/;

function validInvitationToken(value: string | null): string {
  const token = value?.trim() ?? '';
  return token.length > 0 && token.length <= 256 && invitationTokenPattern.test(token) ? token : '';
}

export function inviteTokenFrom(value: string): string {
  const input = value.trim();
  if (!input || input.length > 2048) return '';

  try {
    const url = new URL(input);
    const hashToken = new URLSearchParams(url.hash.slice(1)).get('invite');
    return validInvitationToken(hashToken ?? url.searchParams.get('invite'));
  } catch {
    return validInvitationToken(input);
  }
}

export function pendingInvite() {
  return sessionStorage.getItem(inviteKey) ?? '';
}
export function rememberInvite(value: string) {
  const token = inviteTokenFrom(value);
  if (token) sessionStorage.setItem(inviteKey, token);
  return token;
}
export function clearInvite() {
  sessionStorage.removeItem(inviteKey);
}
export function captureInvite() {
  const url = new URL(window.location.href);
  rememberInvite(url.href);
  if (url.hash) window.history.replaceState(null, '', url.pathname + url.search);
}
