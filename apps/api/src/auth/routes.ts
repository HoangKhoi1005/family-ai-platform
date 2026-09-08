import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Auth } from './auth.js';

const STRIPPED_HEADERS = new Set([
  'host',
  'forwarded',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'x-client-ip',
]);

export function registerAuthRoutes(app: FastifyInstance, auth: Auth, publicOrigin: string): void {
  app.all('/api/auth/*', async (request, reply) => {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return reply
        .code(405)
        .header('Allow', 'GET, POST')
        .send({
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Phương thức chưa được hỗ trợ.' },
        });
    }

    if (
      request.method === 'POST' &&
      !isAllowedMutationOrigin(request.headers.origin, publicOrigin)
    ) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'Nguồn yêu cầu không được phép.' },
      });
    }

    const response = await auth.handler(toAuthRequest(request, publicOrigin));
    reply.code(response.status);
    copyResponseHeaders(response, reply);
    const body = await response.text();
    return body.length > 0 ? reply.send(body) : reply.send();
  });
}

function isAllowedMutationOrigin(origin: string | undefined, publicOrigin: string): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).origin === publicOrigin;
  } catch {
    return false;
  }
}

export function toAuthHeaders(source: Record<string, string | string[] | undefined>): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(source)) {
    if (STRIPPED_HEADERS.has(name.toLowerCase()) || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else {
      headers.set(name, value);
    }
  }

  return headers;
}

function toAuthRequest(request: FastifyRequest, publicOrigin: string): Request {
  const headers = toAuthHeaders(request.headers);
  const body = request.method === 'GET' ? undefined : encodeBody(request.body);
  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (body !== undefined) init.body = body;
  return new Request(new URL(request.url, publicOrigin), init);
}

function encodeBody(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined;
  return typeof body === 'string' ? body : JSON.stringify(body);
}

function copyResponseHeaders(
  response: Response,
  reply: { header(name: string, value: string | string[]): unknown },
): void {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) reply.header('set-cookie', cookies);
  for (const [name, value] of headers) {
    if (name === 'set-cookie') continue;
    reply.header(name, value);
  }
}
