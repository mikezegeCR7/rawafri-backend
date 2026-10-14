import { randomInt } from 'crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { jwtConfig } from '../config/jwt.config';
import { toSafeUser } from '../users/mappers/user.mapper';
import { UsersService } from '../users/users.service';
import { BCRYPT_ROUNDS } from '../users/constants/users.constants';
import { SafeUser } from '../users/types/safe-user.type';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponse } from './types/auth-response.type';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingEmail = await this.usersService.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingPhone = await this.usersService.findByPhone(dto.phone);
    if (existingPhone) {
      throw new ConflictException('Phone number already registered');
    }

    const user = await this.usersService.createUser({
      email: dto.email,
      password: dto.password,
      phone: dto.phone,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: Role.CUSTOMER,
    });

    return this.issueAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueAuthResponse(toSafeUser(user));
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(dto.email);
    // Never reveal whether the email exists
    if (!user) {
      return {
        message:
          'If an account with that email exists, an OTP has been sent.',
      };
    }
    const otp = this.generateOtp();
    const codeHash = await bcrypt.hash(
      otp,
      BCRYPT_ROUNDS,
    );
    // Expire previous unused OTPs
    await this.prisma.otpToken.updateMany({
      where: {
        identifier: email,
        purpose: OtpPurpose.PASSWORD_RESET,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        expiresAt: new Date(),
      },
    });
    await this.prisma.otpToken.create({
      data: {
        identifier: email,
        purpose: OtpPurpose.PASSWORD_RESET,
        codeHash,
        expiresAt: new Date(
          Date.now() + 10 * 60 * 1000,
        ),
      },
    });
    await this.mailService.sendMail(
      user.email,
      'RawAfri Password Reset OTP',
      `
        <h2>Password Reset</h2>
        <p>Your verification code is:</p>
        <h1>${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, ignore this email.</p>
      `,
    );
    return {
      message:
        'If an account with that email exists, an OTP has been sent.',
    };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const otpToken = await this.prisma.otpToken.findFirst({
      where: {
        identifier: email,
        purpose: OtpPurpose.PASSWORD_RESET,
        usedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (!otpToken) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    if (otpToken.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }
    const isValid = await bcrypt.compare(
      dto.otp,
      otpToken.codeHash,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    await this.prisma.otpToken.update({
      where: {
        id: otpToken.id,
      },
      data: {
        usedAt: new Date(),
      },
    });
    return {
      message: 'OTP verified successfully.',
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const otpToken = await this.prisma.otpToken.findFirst({
      where: {
        identifier: email,
        purpose: OtpPurpose.PASSWORD_RESET,
        usedAt: {
          not: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (!otpToken) {
      throw new BadRequestException(
        'OTP has not been verified',
      );
    }
    if (otpToken.expiresAt < new Date()) {
      throw new BadRequestException(
        'OTP has expired',
      );
    }
    const isValid = await bcrypt.compare(
      dto.otp,
      otpToken.codeHash,
    );
    if (!isValid) {
      throw new BadRequestException(
        'Invalid OTP',
      );
    }
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException(
        'Unable to reset password',
      );
    }
    await this.usersService.updatePassword(
      user.id,
      dto.newPassword,
    );
    await this.prisma.otpToken.deleteMany({
      where: {
        identifier: email,
        purpose: OtpPurpose.PASSWORD_RESET,
      },
    });
    return {
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  /**
   * Exchanges a still-valid refresh token for a brand new access+refresh
   * pair. Rotates the refresh token on every use (the old one is
   * overwritten in the DB, so a stolen/replayed old token stops working
   * the moment the real one is used).
   */
  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string }>(
        dto.refreshToken,
        { secret: jwtConfig.refreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive || !user.refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const matches = await bcrypt.compare(
      dto.refreshToken,
      user.refreshToken,
    );

    if (!matches) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueAuthResponse(toSafeUser(user));
  }

  /** Revokes the stored refresh token so it can no longer be used, even if
   * it hasn't expired yet. */
  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.clearRefreshToken(userId);
    return { message: 'Logged out successfully' };
  }

  private async issueAuthResponse(user: SafeUser): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.generateTokens(user);
    await this.usersService.updateRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  private async generateTokens(
    user: SafeUser,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
        },
        {
          secret: jwtConfig.secret,
          expiresIn: jwtConfig.accessExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        { sub: user.id },
        {
          secret: jwtConfig.refreshSecret,
          expiresIn: jwtConfig.refreshExpiresIn,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}