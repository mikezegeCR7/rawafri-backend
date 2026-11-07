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
import { Transform, Type } from 'class-transformer';

export class OrderItemDto {
  /** The selling unit being bought (e.g. Rice · Mudu). Its product is derived. */
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  /** Optional request for this item, shown to the admin (e.g. "blend the pepper"). */
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Keep each item note under 300 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  note?: string;
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