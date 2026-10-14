import { SafeUser } from '../../users/types/safe-user.type';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}
