import Fastify from 'fastify';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { registerFamilyRoutes } from './routes.js';

const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const familyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rootMemberId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function result<T extends Record<string, unknown>>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}

function graphPool(): Pool {
  const client = {
    query: async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return result([]);
      if (sql.includes("set_config('app.actor_id'")) return result([]);
      if (sql.includes('FROM family_memberships')) {
        return result([{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', role: 'member' }]);
      }
      if (sql.includes('WITH RECURSIVE walk')) {
        return result([
          {
            id: rootMemberId,
            display_name: 'Nguyễn Văn An',
            familiar_name: 'Bác An',
            hometown: null,
            birth_date: null,
            birth_year: 1960,
            deceased: false,
            version: 1,
            distance: 0,
          },
        ]);
      }
      if (sql.includes('FROM relationships')) return result([]);
      throw new Error(`Unexpected query: ${sql}`);
    },
    release: () => undefined,
  } as unknown as PoolClient;
  return { connect: async () => client } as unknown as Pool;
}

describe('relationship family routes', () => {
  it('returns a bounded approved graph for a verified active member', async () => {
    const app = Fastify();
    registerFamilyRoutes(app, {
      auth: {
        api: {
          getSession: async () => ({
            user: { id: actorId, emailVerified: true },
          }),
        },
      } as never,
      runtimePool: graphPool(),
      webOrigin: 'http://127.0.0.1:3200',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/relationships?root_member_id=${rootMemberId}&depth=2`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      root_member_id: rootMemberId,
      depth: 2,
      nodes: [
        {
          id: rootMemberId,
          display_name: 'Nguyễn Văn An',
          familiar_name: 'Bác An',
          hometown: null,
          birth_date: null,
          birth_year: 1960,
          deceased: false,
          version: 1,
          distance: 0,
        },
      ],
      relationships: [],
    });
    await app.close();
  });
});
