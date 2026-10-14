/**
 * Creates the first ADMIN account (or promotes an existing user to ADMIN).
 *
 * A fresh production database has no admins, and promoting a user needs an
 * existing admin, so this is the one-off way in. Run it once per environment.
 *
 * Details come from environment variables so no credentials are ever
 * committed or passed as command arguments:
 *
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_PHONE
 *
 * It uses DATABASE_URL like the app does. Against production (Neon), set
 * DATABASE_URL to the Neon connection string for this one command.
 *
 *   npm run create-admin
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  BCRYPT_ROUNDS,
  NIGERIAN_PHONE_REGEX,
  PASSWORD_STRENGTH_REGEX,
} from '../src/users/constants/users.constants';

const prisma = new PrismaClient();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set it as an environment variable before running.`);
  }
  return value;
}

async function main() {
  const email = required('ADMIN_EMAIL').toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });

  // An account already exists for this email: promote it, never touch its password.
  if (existing) {
    if (existing.role === Role.ADMIN) {
      console.log(`${email} is already an admin. Nothing to do.`);
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: Role.ADMIN, isActive: true },
    });
    console.log(`Promoted existing user ${email} to ADMIN. Their password is unchanged.`);
    return;
  }

  const password = required('ADMIN_PASSWORD');
  const firstName = required('ADMIN_FIRST_NAME');
  const lastName = required('ADMIN_LAST_NAME');
  const phone = required('ADMIN_PHONE');

  // Same rules the API enforces for normal sign-ups.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL is not a valid email address.');
  }
  if (password.length < 8 || !PASSWORD_STRENGTH_REGEX.test(password)) {
    throw new Error(
      'ADMIN_PASSWORD must be at least 8 characters with a lowercase letter, an uppercase letter, and a number or symbol.',
    );
  }
  if (!NIGERIAN_PHONE_REGEX.test(phone)) {
    throw new Error('ADMIN_PHONE must be a Nigerian number, e.g. 08012345678 or +2348012345678.');
  }
  if (await prisma.user.findUnique({ where: { phone } })) {
    throw new Error('ADMIN_PHONE is already used by another account.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.user.create({
    data: { email, passwordHash, phone, firstName, lastName, role: Role.ADMIN },
  });

  console.log(`Created admin account ${email}. Sign in at /login.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
