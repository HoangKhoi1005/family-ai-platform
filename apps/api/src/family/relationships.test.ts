import { describe, expect, it } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
import { FamilyHttpError } from './authorization.js';
import { getRelationshipGraph } from './relationships.js';

const familyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const rootMemberId = '11111111-1111-4111-8111-111111111111';
const childMemberId = '22222222-2222-4222-8222-222222222222';
const relationshipId = '33333333-3333-4333-8333-333333333333';

function result<T extends Record<string, unknown>>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}

function clientWithResults(results: QueryResult<Record<string, unknown>>[]): PoolClient {
  return {
    query: async () => {
      const next = results.shift();
      if (!next) throw new Error('Unexpected query');
      return next;
    },
  } as unknown as PoolClient;
}

describe('getRelationshipGraph', () => {
  it('maps bounded member summaries and approved edges without profile contacts', async () => {
    const client = clientWithResults([
      result([
        {
          id: rootMemberId,
          display_name: 'Nguyễn Văn An',
          familiar_name: 'Bác An',
          hometown: 'Cà Mau',
          birth_date: null,
          birth_year: 1960,
          deceased: false,
          version: 2,
          distance: 0,
        },
        {
          id: childMemberId,
          display_name: 'Nguyễn Minh Bình',
          familiar_name: null,
          hometown: null,
          birth_date: '1990-05-03',
          birth_year: 1990,
          deceased: false,
          version: 1,
          distance: 1,
        },
      ]),
      result([
        {
          id: relationshipId,
          from_member_id: rootMemberId,
          to_member_id: childMemberId,
          type: 'parent_child',
          subtype: 'biological',
          start_date: null,
          end_date: null,
          version: 1,
        },
      ]),
    ]);

    await expect(
      getRelationshipGraph(client, { familyId, rootMemberId, depth: 2 }),
    ).resolves.toEqual({
      root_member_id: rootMemberId,
      depth: 2,
      nodes: [
        {
          id: rootMemberId,
          display_name: 'Nguyễn Văn An',
          familiar_name: 'Bác An',
          hometown: 'Cà Mau',
          birth_date: null,
          birth_year: 1960,
          deceased: false,
          version: 2,
          distance: 0,
        },
        {
          id: childMemberId,
          display_name: 'Nguyễn Minh Bình',
          familiar_name: null,
          hometown: null,
          birth_date: '1990-05-03',
          birth_year: 1990,
          deceased: false,
          version: 1,
          distance: 1,
        },
      ],
      relationships: [
        {
          id: relationshipId,
          from_member_id: rootMemberId,
          to_member_id: childMemberId,
          type: 'parent_child',
          subtype: 'biological',
          start_date: null,
          end_date: null,
          version: 1,
        },
      ],
    });
  });

  it('rejects an unknown root without running an edge query', async () => {
    const client = clientWithResults([result([])]);
    await expect(
      getRelationshipGraph(client, { familyId, rootMemberId, depth: 2 }),
    ).rejects.toMatchObject<Partial<FamilyHttpError>>({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('rejects a graph over 100 nodes instead of silently truncating it', async () => {
    const nodes = Array.from({ length: 101 }, (_, index) => ({
      id: `${index.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`,
      display_name: `Member ${index}`,
      familiar_name: null,
      hometown: null,
      birth_date: null,
      birth_year: null,
      deceased: false,
      version: 1,
      distance: index === 0 ? 0 : 1,
    }));
    const client = clientWithResults([result(nodes)]);

    await expect(
      getRelationshipGraph(client, { familyId, rootMemberId, depth: 4 }),
    ).rejects.toMatchObject<Partial<FamilyHttpError>>({
      statusCode: 400,
      code: 'GRAPH_TOO_LARGE',
    });
  });
});
