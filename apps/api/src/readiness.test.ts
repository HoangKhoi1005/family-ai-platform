import { expect, it } from 'vitest';
import { databaseReadinessProbe } from './readiness.js';

it('checks PostgreSQL with a constant query', async () => {
  const queries: string[] = [];
  const probe = databaseReadinessProbe({
    query: async (query: string) => {
      queries.push(query);
      return { rows: [{ '?column?': 1 }] };
    },
  } as never);

  await probe();

  expect(queries).toEqual(['SELECT 1']);
});
