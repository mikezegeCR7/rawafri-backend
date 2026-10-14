import { Module } from '@nestjs/common';
import { MailerModule, type MailerOptions } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

// nodemailer 10 ships its own type definitions, which no longer line up with
// @nestjs-modules/mailer's `defaults` type. At runtime nodemailer still applies
// `defaults` (including `from`) to every message, so only the type is asserted.
const mailDefaults = {
  from: `"RawAfri" <${process.env.SMTP_FROM}>`,
} as MailerOptions['defaults'];

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      defaults: mailDefaults,
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}