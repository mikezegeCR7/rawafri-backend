import { ApiProperty } from '@nestjs/swagger';

export class SettingsResponseDto {
  @ApiProperty()
  maintenanceMode: boolean;

  @ApiProperty()
  updatedAt: Date;
}