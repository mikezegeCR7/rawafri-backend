import { ApiProperty } from '@nestjs/swagger';

class RecentlyViewedProductCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

class RecentlyViewedProductInventoryDto {
  @ApiProperty()
  stockQuantity: number;
}

class RecentlyViewedProductDto {
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

  @ApiProperty()
  price: string;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  minOrderQuantity: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: RecentlyViewedProductCategoryDto })
  category: RecentlyViewedProductCategoryDto;

  @ApiProperty({ type: RecentlyViewedProductInventoryDto, nullable: true })
  inventory: RecentlyViewedProductInventoryDto | null;
}

export class ProductViewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty()
  viewedAt: Date;

  @ApiProperty({ type: RecentlyViewedProductDto })
  product: RecentlyViewedProductDto;
}