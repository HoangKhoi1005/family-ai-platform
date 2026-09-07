import { expect, it } from 'vitest';
import { readServerConfig } from './index.js';
it.each(['0', '65536', 'NaN', '3.5', ''])('rejects invalid port %s', (PORT) =>
  expect(() => readServerConfig({ PORT })).toThrow(),
);
it('binds locally by default', () => expect(readServerConfig({}).host).toBe('127.0.0.1'));
