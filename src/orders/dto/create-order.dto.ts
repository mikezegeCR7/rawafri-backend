import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUppercase,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  /** The selling unit being bought (e.g. Rice · Mudu). Its product is derived. */
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  addressId: string;

  @IsUUID()
  @IsNotEmpty()
  deliveryZoneId: string;

  @IsString()
  @IsUppercase()
  @IsOptional()
  @MaxLength(50)
  promoCode?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}