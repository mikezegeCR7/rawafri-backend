import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LimitPerMinute } from '../common/throttle';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from './types/jwt-payload.type';
import { BypassMaintenance } from '../common/decorators/bypass-maintenance.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/v1/auth/register
  // Max 5 attempts per minute
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @LimitPerMinute(5)
  @ApiCreatedResponse({ type: AuthResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }
  // POST /api/v1/auth/login
  // Max 10 attempts per minute per IP (allows for shared mobile-carrier IPs)
  @Public()
  @BypassMaintenance()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @LimitPerMinute(10)
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @LimitPerMinute(3)
  @ApiOkResponse({ type: MessageResponseDto })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @LimitPerMinute(5)
  @ApiOkResponse({ type: MessageResponseDto })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<MessageResponseDto> {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @LimitPerMinute(5)
  @ApiOkResponse({ type: MessageResponseDto })
  resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  // POST /api/v1/auth/refresh — exchanges a refresh token for a new pair
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @LimitPerMinute(30)
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto);
  }

  // POST /api/v1/auth/logout — protected by the global JwtAuthGuard
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MessageResponseDto })
  logout(@CurrentUser() user: JwtPayload): Promise<MessageResponseDto> {
    return this.authService.logout(user.sub);
  }
}
 