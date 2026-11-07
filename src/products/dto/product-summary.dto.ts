import { ApiProperty } from '@nestjs/swagger';

// Shared response shape for product lists outside the main catalogue
// (recently viewed, recommended, wishlist).

export class ProductUnitSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Decimal as a string, e.g. "2200.00"' })
  price: string;

  @ApiProperty()
  stockQuantity: number;

  @ApiProperty()
  minOrderQuantity: number;

  @ApiProperty()
  sortOrder: number;
}

export class ProductSummaryCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class ProductSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  categoryId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: ProductSummaryCategoryDto })
  category: ProductSummaryCategoryDto;

  @ApiProperty({ type: ProductUnitSummaryDto, isArray: true, description: 'Active selling units, in display order' })
  units: ProductUnitSummaryDto[];
}
