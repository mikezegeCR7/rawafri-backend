import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUppercase,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePromoCodeDto {
  @IsString()
  @IsNotEmpty()
  @IsUppercase()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  @Type(() => Number)
  discountPercent: number;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  maxUses: number;

  @IsDateString()
  expiresAt: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}