import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createRelationshipChangeRequestBodySchema,
  relationshipChangeRequestListQuerySchema,
  relationshipDecisionBodySchema,
  relationshipGraphQuerySchema,
} from './relationships.js';

const firstMember = '11111111-1111-4111-8111-111111111111';
const secondMember = '22222222-2222-4222-8222-222222222222';
const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });

app.post('/graph', { schema: { querystring: relationshipGraphQuerySchema } }, async (request) => ({
  query: request.query,
}));
app.post(
  '/change-request',
  { schema: { body: createRelationshipChangeRequestBodySchema } },
  async (request) => ({ body: request.body }),
);
app.post('/decision', { schema: { body: relationshipDecisionBodySchema } }, async (request) => ({
  body: request.body,
}));
app.get(
  '/requests',
  { schema: { querystring: relationshipChangeRequestListQuerySchema } },
  async (request) => ({
    query: request.query,
  }),
);

beforeAll(async () => app.ready());
afterAll(async () => app.close());

async function validate(options: {
  route: '/graph' | '/change-request' | '/decision' | '/requests';
  location: 'body' | 'querystring';
  value: unknown;
}) {
  if (options.location === 'querystring') {
    return app.inject({
      method: options.route === '/requests' ? 'GET' : 'POST',
      url: `${options.route}?${new URLSearchParams(options.value as Record<string, string>)}`,
    });
  }
  return app.inject({
    method: 'POST',
    url: options.route,
    payload: options.value as Record<string, unknown>,
  });
}

describe('relationship API schemas', () => {
  it('accepts a bounded graph query and rejects depth above four', async () => {
    const accepted = await validate({
      route: '/graph',
      location: 'querystring',
      value: { root_member_id: firstMember, depth: '4' },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().query).toEqual({ root_member_id: firstMember, depth: 4 });

    const rejected = await validate({
      route: '/graph',
      location: 'querystring',
      value: { root_member_id: firstMember, depth: '5' },
    });
    expect(rejected.statusCode).toBe(400);
  });

  it.each(['biological', 'adoptive', 'unspecified'])(
    'accepts parent-child subtype %s without partnership dates',
    async (subtype) => {
      const response = await validate({
        route: '/change-request',
        location: 'body',
        value: {
          type: 'relationship_create',
          payload: {
            from_member_id: firstMember,
            to_member_id: secondMember,
            type: 'parent_child',
            subtype,
          },
        },
      });
      expect(response.statusCode).toBe(200);
    },
  );

  it.each(['married', 'partner'])(
    'accepts partnership subtype %s and ISO dates',
    async (subtype) => {
      const response = await validate({
        route: '/change-request',
        location: 'body',
        value: {
          type: 'relationship_create',
          payload: {
            from_member_id: firstMember,
            to_member_id: secondMember,
            type: 'partnership',
            subtype,
            start_date: '2020-02-29',
            end_date: null,
          },
        },
      });
      expect(response.statusCode).toBe(200);
    },
  );

  it('rejects fields from the wrong relationship kind and unknown fields', async () => {
    const wrongKind = await validate({
      route: '/change-request',
      location: 'body',
      value: {
        type: 'relationship_create',
        payload: {
          from_member_id: firstMember,
          to_member_id: secondMember,
          type: 'parent_child',
          subtype: 'married',
          start_date: '2020-01-01',
        },
      },
    });
    expect(wrongKind.statusCode).toBe(400);

    const unknown = await validate({
      route: '/change-request',
      location: 'body',
      value: {
        type: 'relationship_remove',
        target_id: firstMember,
        base_version: 1,
        payload: {},
      },
    });
    expect(unknown.statusCode).toBe(400);
  });

  it('requires target and base version for updates', async () => {
    const rejected = await validate({
      route: '/change-request',
      location: 'body',
      value: { type: 'relationship_update', payload: { subtype: 'adoptive' } },
    });
    expect(rejected.statusCode).toBe(400);

    const accepted = await validate({
      route: '/change-request',
      location: 'body',
      value: {
        type: 'relationship_update',
        target_id: firstMember,
        base_version: 2,
        payload: { subtype: 'adoptive' },
      },
    });
    expect(accepted.statusCode).toBe(200);
  });

  it('accepts a minimal new-member proposal linked to an existing member', async () => {
    const accepted = await validate({
      route: '/change-request',
      location: 'body',
      value: {
        type: 'member_create',
        payload: {
          member: {
            display_name: 'Nguyễn Minh Anh',
            familiar_name: 'Bé An',
            hometown: 'Cà Mau',
            birth_year: 2018,
            deceased: false,
          },
          relationship: {
            anchor_member_id: firstMember,
            kind: 'child',
            subtype: 'biological',
          },
        },
      },
    });
    expect(accepted.statusCode).toBe(200);
  });

  it('rejects sensitive or incompatible fields in a new-member proposal', async () => {
    const sensitive = await validate({
      route: '/change-request',
      location: 'body',
      value: {
        type: 'member_create',
        payload: {
          member: { display_name: 'Nguyễn Minh Anh', phone: '0900000000' },
          relationship: {
            anchor_member_id: firstMember,
            kind: 'child',
            subtype: 'biological',
          },
        },
      },
    });
    expect(sensitive.statusCode).toBe(400);

    const incompatible = await validate({
      route: '/change-request',
      location: 'body',
      value: {
        type: 'member_create',
        payload: {
          member: { display_name: 'Nguyễn Minh Anh' },
          relationship: {
            anchor_member_id: firstMember,
            kind: 'partner',
            subtype: 'adoptive',
          },
        },
      },
    });
    expect(incompatible.statusCode).toBe(400);
  });

  it('supports administrator and requester list scopes only', async () => {
    const mine = await validate({
      route: '/requests',
      location: 'querystring',
      value: { status: 'pending', scope: 'mine' },
    });
    expect(mine.statusCode).toBe(200);
    expect(mine.json().query).toEqual({ status: 'pending', scope: 'mine' });

    const rejected = await validate({
      route: '/requests',
      location: 'querystring',
      value: { scope: 'family' },
    });
    expect(rejected.statusCode).toBe(400);
  });

  it('rejects malformed decision fields', async () => {
    const unknown = await validate({
      route: '/decision',
      location: 'body',
      value: { decision: 'approved', version: 1, reviewer_id: firstMember },
    });
    expect(unknown.statusCode).toBe(400);

    const invalidDecision = await validate({
      route: '/decision',
      location: 'body',
      value: { decision: 'cancelled', version: 1 },
    });
    expect(invalidDecision.statusCode).toBe(400);
  });
});
