import { IsNotEmpty, IsString, IsUppercase } from 'class-validator';

export class ValidatePromoCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}