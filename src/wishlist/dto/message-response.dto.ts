import { ApiProperty } from '@nestjs/swagger';

export class WishlistMessageResponseDto {
  @ApiProperty()
  message: string;
}