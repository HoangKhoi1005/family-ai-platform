import type { Auth } from './auth.js';

export async function getVerifiedActor(
  auth: Auth,
  headers: Headers,
): Promise<{ userId: string } | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user.emailVerified) return null;
  return { userId: session.user.id };
}
