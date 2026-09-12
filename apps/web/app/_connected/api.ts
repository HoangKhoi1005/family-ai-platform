export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
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
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
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
export function explain(error: unknown): string {
  if (!(error instanceof RequestError)) return 'Chưa kết nối được. Kiểm tra mạng và thử lại nhé.';
  if (error.code === 'REQUEST_TIMEOUT') return 'Kết nối mất quá lâu. Kiểm tra mạng và thử lại nhé.';
  if (error.code === 'NETWORK_ERROR') return 'Chưa kết nối được. Kiểm tra mạng và thử lại nhé.';
  if (error.code === 'REQUEST_ABORTED') return 'Yêu cầu đã được dừng. Vui lòng thử lại.';
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
