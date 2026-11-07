import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Stock-only edit for one selling unit (admin Inventory page). */
export class UpdateUnitStockDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  stockQuantity?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  lowStockThreshold?: number;
}
