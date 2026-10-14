import { ApiProperty } from '@nestjs/swagger';
import { SafeUserResponseDto } from '../../users/dto/safe-user-response.dto';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: SafeUserResponseDto })
  user: SafeUserResponseDto;
}
