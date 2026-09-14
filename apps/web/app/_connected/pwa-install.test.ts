import { describe, expect, it } from 'vitest';

async function loadModel() {
  const modulePath = './pwa-install';
  return import(modulePath).catch(() => null);
}

describe('PWA installation model', () => {
  it('keeps installed mode ahead of another available prompt', async () => {
    const model = await loadModel();
    expect(model).not.toBeNull();
    expect(
      model?.resolveInstallState({ standalone: true, appleMobile: false, promptReady: true }),
    ).toBe('installed');
  });

  it('offers the browser prompt only when its event is available', async () => {
    const model = await loadModel();
    expect(
      model?.resolveInstallState({ standalone: false, appleMobile: false, promptReady: true }),
    ).toBe('prompt-ready');
  });

  it('uses manual instructions for an Apple mobile browser', async () => {
    const model = await loadModel();
    expect(
      model?.resolveInstallState({ standalone: false, appleMobile: true, promptReady: false }),
    ).toBe('ios-instructions');
  });

  it('falls back without claiming installation support', async () => {
    const model = await loadModel();
    expect(
      model?.resolveInstallState({ standalone: false, appleMobile: false, promptReady: false }),
    ).toBe('fallback');
  });

  it('recognizes iPad desktop user agents with touch support', async () => {
    const model = await loadModel();
    expect(
      model?.isAppleMobileBrowser({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('does not label desktop Safari as an iPhone or iPad', async () => {
    const model = await loadModel();
    expect(
      model?.isAppleMobileBrowser({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });

  it('keeps an early browser prompt until the profile panel can consume it', async () => {
    const model = await loadModel();
    const prompt = Object.assign(new Event('beforeinstallprompt'), {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    });

    expect(model?.rememberInstallPrompt).toBeTypeOf('function');
    model?.rememberInstallPrompt(prompt);

    expect(model?.currentInstallPrompt()).toBe(prompt);
    expect(model?.takeInstallPrompt()).toBe(prompt);
    expect(model?.currentInstallPrompt()).toBeNull();
  });
});
