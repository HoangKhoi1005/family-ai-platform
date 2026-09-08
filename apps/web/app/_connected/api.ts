export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : method,
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new RequestError(response.status, data?.error?.code ?? data?.code ?? 'REQUEST_FAILED');
  return data as T;
}
export function explain(error: unknown): string {
  if (!(error instanceof RequestError)) return 'Chưa kết nối được. Kiểm tra mạng và thử lại nhé.';
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
export function pendingInvite() {
  return sessionStorage.getItem(inviteKey) ?? '';
}
export function clearInvite() {
  sessionStorage.removeItem(inviteKey);
}
export function captureInvite() {
  const url = new URL(window.location.href);
  const token = new URLSearchParams(url.hash.slice(1)).get('invite');
  if (token && token.length <= 256) sessionStorage.setItem(inviteKey, token);
  if (url.hash) window.history.replaceState(null, '', url.pathname + url.search);
}
