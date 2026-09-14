'use client';

import { useEffect } from 'react';

type RegisterWorker = (scriptURL: string, options: RegistrationOptions) => Promise<unknown>;

export async function registerPwaWorker({
  production,
  register,
  unregister,
}: {
  production: boolean;
  register: RegisterWorker;
  unregister?: () => Promise<unknown>;
}) {
  if (!production) {
    await unregister?.();
    return false;
  }
  await register('/sw.js', { scope: '/' });
  return true;
}

export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      void registerPwaWorker({
        production: process.env.NODE_ENV === 'production',
        register: navigator.serviceWorker.register.bind(navigator.serviceWorker),
        unregister: async () => {
          const registration = await navigator.serviceWorker.getRegistration('/');
          await registration?.unregister();
        },
      }).catch(() => {
        console.info('PWA worker registration unavailable.');
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
