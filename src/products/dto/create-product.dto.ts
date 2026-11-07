import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** One way the product is sold, e.g. "Bag (50kg)", "Paint", "Mudu", "Cup". */
export class ProductUnitDto {
  /** Existing unit to update. Omit to add a new unit. */
  @IsUUID()
  @IsOptional()
  id?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  price: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQuantity: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  lowStockThreshold?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  minOrderQuantity?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
}

export class CreateProductDto {
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  slug: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  /** At least one selling unit. On update, the list replaces the product's
   * units: listed units are kept/updated/added, unlisted ones are switched off. */
  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one selling unit (e.g. Bag, Paint, Mudu)' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductUnitDto)
  units: ProductUnitDto[];
}
