import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
if (existsSync('.env')) {
  console.log('.env already exists; preserved without changes.');
} else {
  const password = randomBytes(24).toString('hex');
  writeFileSync(
    '.env',
    `POSTGRES_USER=family_owner\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=family_dev\nPOSTGRES_PORT=54329\nDATABASE_URL=postgresql://family_owner:${password}@127.0.0.1:54329/family_dev\n`,
    { flag: 'wx', mode: 0o600 },
  );
  console.log('Created ignored .env with local-only random credentials.');
}
