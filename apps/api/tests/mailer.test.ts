import { describe, expect, it } from 'vitest';
import { createAuthMailer } from '../src/auth/mailer.js';

describe('AuthMailer', () => {
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
