import { ApiProperty } from '@nestjs/swagger';
import { ProductSummaryDto } from '../../products/dto/product-summary.dto';

export class WishlistItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: ProductSummaryDto })
  product: ProductSummaryDto;
}
