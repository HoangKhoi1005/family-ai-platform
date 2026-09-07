import { readServerConfig } from '@family/config';
import { buildApp } from './app.js';
const config = readServerConfig(process.env);
const app = buildApp();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app.close();
  });
await app.listen({ port: config.port, host: config.host });
