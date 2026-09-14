export type InstallState = 'installed' | 'prompt-ready' | 'ios-instructions' | 'fallback';

export function resolveInstallState({
  standalone,
  appleMobile,
  promptReady,
}: {
  standalone: boolean;
  appleMobile: boolean;
  promptReady: boolean;
}): InstallState {
  if (standalone) return 'installed';
  if (promptReady) return 'prompt-ready';
  if (appleMobile) return 'ios-instructions';
  return 'fallback';
}

export function isAppleMobileBrowser({
  userAgent,
  platform,
  maxTouchPoints,
}: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}) {
  return /iPhone|iPad|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}
