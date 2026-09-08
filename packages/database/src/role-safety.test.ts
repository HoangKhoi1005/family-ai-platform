import { describe, expect, it } from 'vitest';
import { assertSafeApplicationRole } from './role-safety.js';

function fakePool(responses: unknown[]) {
  let index = 0;
  return {
    query: async () => {
      const response = responses[index++];
      if (response === undefined) throw new Error('unexpected query');
      return response;
    },
  } as never;
}

const safeAuthResponses = [
  {
    rowCount: 1,
    rows: [
      {
        current_user: 'family_auth',
        rolcanlogin: true,
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolinherit: false,
        rolreplication: false,
      },
    ],
  },
  { rowCount: 0, rows: [] },
  { rowCount: 0, rows: [] },
  { rowCount: 0, rows: [] },
  { rowCount: 0, rows: [] },
];

describe('assertSafeApplicationRole', () => {
  it('rejects a connection whose actual role is the owner', async () => {
    const pool = fakePool([
      {
        rowCount: 1,
        rows: [
          {
            current_user: 'family_owner',
            rolcanlogin: true,
            rolsuper: false,
            rolbypassrls: false,
            rolcreatedb: true,
            rolcreaterole: true,
            rolinherit: true,
            rolreplication: false,
          },
        ],
      },
    ]);

    await expect(assertSafeApplicationRole(pool, 'family_auth')).rejects.toThrow(
      'family_auth connection must use the restricted role',
    );
  });

  it('rejects a restricted role that owns an application object', async () => {
    const pool = fakePool([
      safeAuthResponses[0],
      { rowCount: 1, rows: [{ object_schema: 'public', object_name: 'users' }] },
    ]);

    await expect(assertSafeApplicationRole(pool, 'family_auth')).rejects.toThrow(
      'must not own application objects',
    );
  });

  it('accepts a restricted auth role with no unsafe grants', async () => {
    await expect(
      assertSafeApplicationRole(fakePool(safeAuthResponses), 'family_auth'),
    ).resolves.toBe(undefined);
  });

  it('rejects auth access to a newly added public table', async () => {
    await expect(
      assertSafeApplicationRole(
        fakePool([
          ...safeAuthResponses.slice(0, 4),
          { rowCount: 1, rows: [{ table_name: 'future_tenant_table', privilege_type: 'SELECT' }] },
        ]),
        'family_auth',
      ),
    ).rejects.toThrow('forbidden SELECT on future_tenant_table');
  });
});
