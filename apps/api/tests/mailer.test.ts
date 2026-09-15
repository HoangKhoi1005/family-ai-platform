import { describe, expect, it } from 'vitest';
import { authTransportOptions, createAuthMailer } from '../src/auth/mailer.js';

describe('AuthMailer', () => {
  it('requires STARTTLS and authenticated SMTP outside local development', () => {
    expect(
      authTransportOptions({
        smtpHost: 'smtp.resend.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'resend',
        smtpPassword: 'private-secret',
        mailFrom: 'no-reply@example.test',
      }),
    ).toMatchObject({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'resend', pass: 'private-secret' },
    });
  });

  it('keeps local Mailpit transport unauthenticated', () => {
    expect(
      authTransportOptions({
        smtpHost: '127.0.0.1',
        smtpPort: 1035,
        smtpSecure: false,
        mailFrom: 'no-reply@family-ai.local',
      }),
    ).not.toHaveProperty('auth');
  });

  it('tracks delivery and drains all pending messages', async () => {
    let resolveDelivery!: () => void;
    const delivery = new Promise<void>((resolve) => {
      resolveDelivery = resolve;
    });
    const messages: Array<{ to: string; text: string }> = [];
    const mailer = createAuthMailer(
      {
        smtpHost: '127.0.0.1',
        smtpPort: 1035,
        mailFrom: 'no-reply@family-ai.local',
      },
      {
        sendMail: async (message) => {
          messages.push({ to: String(message.to), text: String(message.text) });
          await delivery;
          return {};
        },
      },
    );

    mailer.sendVerification('person@example.test', 'http://127.0.0.1/verify?token=secret');
    const drained = mailer.drain();
    let settled = false;
    void drained.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.to).toBe('person@example.test');
    expect(messages[0]?.text).toContain('http://127.0.0.1/verify?token=secret');

    resolveDelivery();
    await drained;
    expect(settled).toBe(true);
  });

  it('logs a generic delivery failure without exposing the recipient or URL', async () => {
    const logs: string[] = [];
    const mailer = createAuthMailer(
      {
        smtpHost: '127.0.0.1',
        smtpPort: 1035,
        mailFrom: 'no-reply@family-ai.local',
      },
      {
        sendMail: async () => {
          throw new Error('smtp private detail');
        },
      },
      (message) => logs.push(message),
    );

    mailer.sendReset('secret@example.test', 'http://127.0.0.1/reset?token=secret');
    await mailer.drain();
    expect(logs).toEqual(['AUTH_EMAIL_DELIVERY_FAILED']);
    expect(logs.join()).not.toContain('secret@example.test');
    expect(logs.join()).not.toContain('token=secret');
  });
});
