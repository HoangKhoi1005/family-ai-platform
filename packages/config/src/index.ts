export function readServerConfig(env: Record<string, string | undefined>, portVariable = 'PORT') {
  const port = Number(env[portVariable] ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`${portVariable} must be an integer between 1 and 65535`);
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('Invalid NODE_ENV');
  return { port, host: env.HOST ?? '127.0.0.1', nodeEnv };
}
