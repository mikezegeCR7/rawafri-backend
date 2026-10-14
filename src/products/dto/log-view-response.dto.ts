import { ApiProperty } from '@nestjs/swagger';

export class LogViewResponseDto {
  @ApiProperty()
  message: string;
}