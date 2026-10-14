import {
  IsEmail,
  IsString,
  Length,
} from 'class-validator';
import { StrongPassword } from '../../users/validators/account-rules';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  otp: string;

  // Same rule as sign-up, so a reset can't set a weak password.
  @StrongPassword()
  newPassword: string;
}
