export const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'service'],
  properties: {
    status: { type: 'string', enum: ['ok'] },
    service: { type: 'string', enum: ['family-api'] },
  },
} as const;
export interface HealthResponse {
  status: 'ok';
  service: 'family-api';
}
export interface ApiError {
  error: { code: string; message: string; request_id: string };
}
export * from './onboarding.js';
export * from './profile.js';
