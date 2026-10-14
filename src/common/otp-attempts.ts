import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../prisma/prisma.service';

/** Wrong guesses allowed per code before it is retired and a new one is needed. */
export const MAX_OTP_ATTEMPTS = 5;

type OtpTokenRef = { id: string; codeHash: string };

/**
 * Checks a submitted 6-digit code against a stored OTP token, allowing at
 * most MAX_OTP_ATTEMPTS tries per code.
 *
 * Every try is counted *before* the comparison with an atomic increment, so
 * parallel guesses can't exceed the limit. Once the limit is reached the code
 * is expired and the customer has to request a new one.
 */
export async function verifyOtpAttempt(
  prisma: PrismaService,
  token: OtpTokenRef,
  submittedCode: string,
): Promise<void> {
  const { attempts } = await prisma.otpToken.update({
    where: { id: token.id },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  });

  if (attempts > MAX_OTP_ATTEMPTS) {
    throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
  }

  const isValid = await bcrypt.compare(submittedCode, token.codeHash);
  if (isValid) return;

  const remaining = MAX_OTP_ATTEMPTS - attempts;
  if (remaining <= 0) {
    // Retire the code so it can't be tried again.
    await prisma.otpToken.update({ where: { id: token.id }, data: { expiresAt: new Date() } });
    throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
  }
  throw new BadRequestException(
    `That code is incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
  );
}
