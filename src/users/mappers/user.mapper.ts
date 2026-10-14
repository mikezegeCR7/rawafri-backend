import { User } from '@prisma/client';
import { SafeUser } from '../types/safe-user.type';

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, refreshToken: _refreshToken, ...safeUser } =
    user;
  return safeUser;
}
