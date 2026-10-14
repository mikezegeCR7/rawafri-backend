import { ApiProperty } from '@nestjs/swagger';

class RecommendedProductCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

class RecommendedProductInventoryDto {
  @ApiProperty()
  stockQuantity: number;
}

export class RecommendedProductDto {
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

  @ApiProperty({ type: RecommendedProductCategoryDto })
  category: RecommendedProductCategoryDto;

  @ApiProperty({ type: RecommendedProductInventoryDto, nullable: true })
  inventory: RecommendedProductInventoryDto | null;
}