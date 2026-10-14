import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  NIGERIAN_PHONE_REGEX,
  PASSWORD_STRENGTH_REGEX,
} from '../constants/users.constants';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_STRENGTH_REGEX, {
    message:
      'Password must contain uppercase, lowercase, and a number or special character',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @Matches(NIGERIAN_PHONE_REGEX, {
    message: 'Phone must be a valid Nigerian phone number',
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
