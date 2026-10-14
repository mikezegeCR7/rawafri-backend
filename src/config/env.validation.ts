import { Logger } from '@nestjs/common';

/**
 * Checked once at startup. In production a missing or weak setting stops the
 * app with a clear message instead of silently running with a fallback
 * (the JWT refresh secret used to default to the public string 'change-me').
 * In development, missing optional services only produce a warning.
 */
const ALWAYS_REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

const REQUIRED_IN_PRODUCTION = [
  'ALLOWED_ORIGINS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const;

const MIN_SECRET_LENGTH = 32;

export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const logger = new Logger('Env');
  const isProduction = env.NODE_ENV === 'production';
  const missing = (keys: readonly string[]) => keys.filter((k) => !env[k]?.trim());
  const problems: string[] = [];

  const missingAlways = missing(ALWAYS_REQUIRED);
  if (missingAlways.length) problems.push(`missing ${missingAlways.join(', ')}`);

  const missingProd = missing(REQUIRED_IN_PRODUCTION);
  if (missingProd.length) {
    if (isProduction) problems.push(`missing ${missingProd.join(', ')}`);
    else logger.warn(`Not set (fine for local dev, required in production): ${missingProd.join(', ')}`);
  }

  if (isProduction) {
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const value = env[key] ?? '';
      if (value && (value.length < MIN_SECRET_LENGTH || value === 'change-me')) {
        problems.push(`${key} must be a random string of at least ${MIN_SECRET_LENGTH} characters`);
      }
    }
    if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
      problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }
  }

  if (problems.length) {
    throw new Error(`Invalid environment configuration: ${problems.join('; ')}`);
  }
}
