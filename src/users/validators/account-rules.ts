import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NIGERIAN_PHONE_REGEX, PASSWORD_STRENGTH_REGEX } from '../constants/users.constants';

/**
 * One definition of the account rules, shared by sign-up, password reset and
 * profile edits so they can't drift apart.
 */

export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number or symbol';

export const PHONE_RULE_MESSAGE = 'Enter a valid Nigerian phone number, e.g. 08012345678 or +2348012345678';

/** At least 8 characters with upper, lower, and a number or symbol. */
export const StrongPassword = () =>
  applyDecorators(
    IsString(),
    IsNotEmpty(),
    MinLength(8, { message: PASSWORD_RULE_MESSAGE }),
    MaxLength(128),
    Matches(PASSWORD_STRENGTH_REGEX, { message: PASSWORD_RULE_MESSAGE }),
  );

/** Spaces, dashes and brackets removed; "+234…" stored as "0…", so the same
 * number always has one form and can't register two accounts. */
export function normalizeNigerianPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const compact = value.replace(/[\s\-()]/g, '');
  return /^\+234\d{10}$/.test(compact) ? `0${compact.slice(4)}` : compact;
}

/** Nigerian mobile number, e.g. "0801 234 5678" or "+2348012345678",
 * both stored as "08012345678". */
export const NigerianPhone = () =>
  applyDecorators(
    Transform(({ value }) => normalizeNigerianPhone(value)),
    IsString(),
    Matches(NIGERIAN_PHONE_REGEX, { message: PHONE_RULE_MESSAGE }),
  );
