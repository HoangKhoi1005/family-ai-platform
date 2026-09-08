import Fastify, { LogController } from 'fastify';
import { healthResponseSchema, type HealthResponse, type ApiError } from '@family/contracts';
import type { Pool } from 'pg';
import { withActorTransaction } from '@family/database';
import type { Auth } from './auth/auth.js';
import { registerAuthRoutes, toAuthHeaders } from './auth/routes.js';
import { getVerifiedActor } from './auth/session.js';
import { registerFamilyRoutes } from './family/routes.js';
import { listOwnMemberships } from './family/memberships.js';

export interface AppOptions {
  auth?: Auth;
  publicOrigin?: string;
  runtimePool?: Pool;
}

export function buildApp(options: AppOptions = {}) {
  if ((options.auth && !options.publicOrigin) || (!options.auth && options.publicOrigin)) {
    throw new Error('auth and publicOrigin must be configured together');
  }
  if (options.runtimePool && !options.auth) {
    throw new Error('runtimePool requires auth');
  }

  const app = Fastify({
    logger: { level: 'info', redact: ['req.headers.authorization', 'req.headers.cookie'] },
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 1048576,
  });
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
  });
  app.get(
    '/health/live',
    { schema: { response: { 200: healthResponseSchema } } },
    async (): Promise<HealthResponse> => ({ status: 'ok', service: 'family-api' }),
  );

  if (options.auth && options.publicOrigin) {
    const { auth, publicOrigin } = options;
    registerAuthRoutes(app, auth, publicOrigin);
    if (options.runtimePool) {
      registerFamilyRoutes(app, {
        auth,
        runtimePool: options.runtimePool,
        webOrigin: publicOrigin,
      });
    }
    app.get('/api/v1/me', async (request, reply) => {
      const headers = toAuthHeaders(request.headers);
      const actor = await getVerifiedActor(auth, headers);
      if (!actor) {
        return reply.code(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Yêu cầu xác thực.',
            request_id: request.id,
          },
        });
      }
      const session = await auth.api.getSession({ headers });
      if (!session?.user.emailVerified || session.user.id !== actor.userId) {
        return reply.code(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Yêu cầu xác thực.',
            request_id: request.id,
          },
        });
      }
      const memberships = options.runtimePool
        ? await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            listOwnMemberships(client, actor.userId),
          )
        : [];
      return {
        user: {
          id: actor.userId,
          name: session.user.name,
          email: session.user.email,
        },
        memberships,
      };
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const response: ApiError = {
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy nội dung.', request_id: request.id },
    };
    return reply.code(404).send(response);
  });
  app.setErrorHandler((error, request, reply) => {
    // Do not log raw error/request body; these may contain family information.
    const status =
      error !== null &&
      typeof error === 'object' &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode < 500
        ? error.statusCode
        : 500;
    const response: ApiError = {
      error: {
        code: status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
        message: status < 500 ? 'Yêu cầu chưa hợp lệ.' : 'Có lỗi xảy ra. Vui lòng thử lại.',
        request_id: request.id,
      },
    };
    return reply.code(status).send(response);
  });
  return app;
}
