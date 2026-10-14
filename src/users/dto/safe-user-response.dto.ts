import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * Response shape for a user with sensitive fields stripped
 * (no passwordHash, no refreshToken).
 *
 * This mirrors `SafeUser` (`src/users/types/safe-user.type.ts`) but as a
 * class so Swagger/OpenAPI can introspect it and downstream codegen
 * (orval, etc.) produces real types instead of `void`/`unknown`.
 */
export class SafeUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
