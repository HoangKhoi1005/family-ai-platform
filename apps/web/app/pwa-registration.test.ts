import { describe, expect, it, vi } from 'vitest';

async function loadRegistration() {
  const modulePath = './pwa-registration';
  return import(modulePath).catch(() => null);
}

describe('PWA service-worker registration', () => {
  it('registers the root worker in production', async () => {
    const module = await loadRegistration();
    const register = vi.fn(async () => undefined);

    expect(module).not.toBeNull();
    await module?.registerPwaWorker({ production: true, register });

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('removes a same-origin PWA worker outside production', async () => {
    const module = await loadRegistration();
    const register = vi.fn(async () => undefined);
    const unregister = vi.fn(async () => undefined);

    await module?.registerPwaWorker({ production: false, register, unregister });

    expect(register).not.toHaveBeenCalled();
    expect(unregister).toHaveBeenCalledOnce();
  });
});
