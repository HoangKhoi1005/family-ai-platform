import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestError, request } from './api';

describe('connected request', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports a timed out request separately from an HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_path: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted', 'AbortError')),
            );
          }),
      ),
    );

    await expect(request('/api/v1/me', undefined, 'GET', { timeoutMs: 5 })).rejects.toEqual(
      new RequestError(0, 'REQUEST_TIMEOUT'),
    );
  });

  it('reports cancellation requested by the caller separately from a timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_path: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted', 'AbortError')),
            );
          }),
      ),
    );
    const controller = new AbortController();
    const pending = request('/api/v1/me', undefined, 'GET', {
      signal: controller.signal,
      timeoutMs: 1000,
    });

    controller.abort();

    await expect(pending).rejects.toEqual(new RequestError(0, 'REQUEST_ABORTED'));
  });
});
