import { JwtSignOptions } from '@nestjs/jwt';

const toExpiresIn = (value: string | undefined, fallback: string) =>
  (value ?? fallback) as JwtSignOptions['expiresIn'];

export const jwtConfig = {
  // No fallback: validateEnv() (main.ts) refuses to start without these.
  secret: process.env.JWT_SECRET ?? '',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  accessExpiresIn: toExpiresIn(process.env.JWT_ACCESS_EXPIRES_IN, '15m'),
  refreshExpiresIn: toExpiresIn(process.env.JWT_REFRESH_EXPIRES_IN, '7d'),
} as const;
