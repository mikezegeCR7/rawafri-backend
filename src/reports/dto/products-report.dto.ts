import { ApiProperty } from '@nestjs/swagger';

export class ProductsReportDto {
  @ApiProperty()
  totalProducts: number;

  @ApiProperty()
  activeProducts: number;

  @ApiProperty()
  lowStockProducts: number;

  @ApiProperty()
  outOfStockProducts: number;
}