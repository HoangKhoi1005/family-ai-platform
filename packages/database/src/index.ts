import { Pool } from 'pg';
export {
  assertSafeApplicationRole,
  assertSafeApplicationRoles,
  type ApplicationRole,
} from './role-safety.js';
export { withActorTransaction } from './tenant.js';
export function createDatabasePool(connectionString: string): Pool {
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://'))
    throw new Error('A PostgreSQL connection URL is required');
  return new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
}
