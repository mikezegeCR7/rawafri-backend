import { ApiProperty } from '@nestjs/swagger';
import { ProductSummaryDto } from './product-summary.dto';

export class ProductViewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty()
  viewedAt: Date;

  @ApiProperty({ type: ProductSummaryDto })
  product: ProductSummaryDto;
}
