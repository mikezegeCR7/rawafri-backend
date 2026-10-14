import { ApiProperty } from '@nestjs/swagger';

class WishlistProductCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

class WishlistProductInventoryDto {
  @ApiProperty()
  stockQuantity: number;
}

class WishlistProductDto {
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

  @ApiProperty({ type: WishlistProductCategoryDto })
  category: WishlistProductCategoryDto;

  @ApiProperty({ type: WishlistProductInventoryDto, nullable: true })
  inventory: WishlistProductInventoryDto | null;
}

export class WishlistItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: WishlistProductDto })
  product: WishlistProductDto;
}