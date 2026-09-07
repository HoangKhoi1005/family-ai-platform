import { readServerConfig } from '@family/config';
readServerConfig(process.env);
console.info('Worker scaffold ready. No job handlers registered; no notifications sent.');
// Lifecycle only. Implement transactional outbox and delivery policy before adding handlers.
const keepAlive = setInterval(() => {}, 60000);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    clearInterval(keepAlive);
  });
