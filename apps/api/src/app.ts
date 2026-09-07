import Fastify, { LogController } from 'fastify';
import { healthResponseSchema, type HealthResponse, type ApiError } from '@family/contracts';
export function buildApp() {
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
