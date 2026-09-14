export type InstallState = 'installed' | 'prompt-ready' | 'ios-instructions' | 'fallback';

export type StoredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export const INSTALL_PROMPT_CHANGE_EVENT = 'family-pwa-install-prompt-change';

let pendingInstallPrompt: StoredInstallPrompt | null = null;

export function rememberInstallPrompt(prompt: StoredInstallPrompt) {
  pendingInstallPrompt = prompt;
}

export function currentInstallPrompt() {
  return pendingInstallPrompt;
}

export function takeInstallPrompt() {
  const prompt = pendingInstallPrompt;
  pendingInstallPrompt = null;
  return prompt;
}

export function clearInstallPrompt() {
  pendingInstallPrompt = null;
}

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
