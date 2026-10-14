import { JwtSignOptions } from '@nestjs/jwt';

const toExpiresIn = (value: string | undefined, fallback: string) =>
  (value ?? fallback) as JwtSignOptions['expiresIn'];

export const jwtConfig = {
  secret: process.env.JWT_SECRET ?? 'change-me',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me',
  accessExpiresIn: toExpiresIn(process.env.JWT_ACCESS_EXPIRES_IN, '15m'),
  refreshExpiresIn: toExpiresIn(process.env.JWT_REFRESH_EXPIRES_IN, '7d'),
} as const;
