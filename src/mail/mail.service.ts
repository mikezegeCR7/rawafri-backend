import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import type { EmailContent } from './templates';

/** Domains reserved for testing (RFC 2606 / RFC 6761) — mail to them can never arrive. */
const RESERVED_DOMAIN = /@(?:[^@]+\.)?(?:example\.(?:com|net|org)|[^@]+\.(?:test|example|invalid|localhost))$|@(?:example|test|invalid|localhost)$/i;

export const isUndeliverable = (email: string) => RESERVED_DOMAIN.test(email.trim());

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
  ) {}

  /** Sends now and throws if it fails — for codes the person is waiting on. */
  async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    if (isUndeliverable(to)) {
      // Seed / test accounts use reserved domains (example.test, example.com…).
      // Sending to them only produces bounces in the sender's inbox.
      this.logger.log(`Skipped email to test address ${to}: ${subject}`);
      return;
    }

    try {
      await this.mailerService.sendMail({
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${subject}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }

  async send(to: string, email: EmailContent): Promise<void> {
    return this.sendMail(to, email.subject, email.html);
  }

  /**
   * Sends in the background for updates (order placed, payment confirmed…):
   * a slow or failing mail server must never hold up or fail the action
   * that triggered it. Failures are logged.
   */
  sendInBackground(to: string | string[], email: EmailContent): void {
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
    for (const recipient of recipients) {
      this.send(recipient, email).catch(() => {
        // Already logged in sendMail.
      });
    }
  }
}
