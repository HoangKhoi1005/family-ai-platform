import nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';

export interface AuthMailer {
  sendVerification(to: string, url: string): void;
  sendReset(to: string, url: string): void;
  drain(): Promise<void>;
}

export interface AuthMailerConfig {
  smtpHost: string;
  smtpPort: number;
  mailFrom: string;
}

interface AuthTransport {
  sendMail(message: SendMailOptions): Promise<unknown>;
}

const SMTP_TIMEOUT_MS = 5_000;

export function createAuthMailer(
  config: AuthMailerConfig,
  transport: AuthTransport = createTransport(config),
  log: (message: string) => void = (message) => console.error(message),
): AuthMailer {
  const pending = new Set<Promise<void>>();

  function queue(message: SendMailOptions): void {
    const delivery = Promise.resolve()
      .then(() => transport.sendMail(message))
      .then(
        () => undefined,
        () => {
          log('AUTH_EMAIL_DELIVERY_FAILED');
        },
      );
    pending.add(delivery);
    void delivery.then(
      () => pending.delete(delivery),
      () => pending.delete(delivery),
    );
  }

  return {
    sendVerification(to, url) {
      queue({
        from: config.mailFrom,
        to,
        subject: 'Xác minh email Family AI',
        text: `Xác minh email của bạn bằng liên kết sau: ${url}`,
      });
    },
    sendReset(to, url) {
      queue({
        from: config.mailFrom,
        to,
        subject: 'Đặt lại mật khẩu Family AI',
        text: `Đặt lại mật khẩu bằng liên kết sau: ${url}`,
      });
    },
    async drain() {
      while (pending.size > 0) await Promise.all([...pending]);
    },
  };
}

function createTransport(config: AuthMailerConfig): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: false,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}
