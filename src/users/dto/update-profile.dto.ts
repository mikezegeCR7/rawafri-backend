import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { NIGERIAN_PHONE_REGEX } from '../constants/users.constants';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(NIGERIAN_PHONE_REGEX, {
    message: 'Phone must be a valid Nigerian phone number',
  })
  phone?: string;
}
