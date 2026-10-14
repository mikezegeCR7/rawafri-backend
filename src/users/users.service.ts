import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from './constants/users.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { toSafeUser } from './mappers/user.mapper';
import { SafeUser } from './types/safe-user.type';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(dto: CreateUserDto): Promise<SafeUser> {
    const email = dto.email.toLowerCase().trim();

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          phone: dto.phone,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: dto.role ?? Role.CUSTOMER,
        },
      });

      return toSafeUser(user);
    } catch (error) {
      this.handlePrismaUniqueViolation(error);
      throw error;
    }
  }

  /**
   * Returns the full user record for internal auth flows (login, token refresh).
   * Never expose the result directly in API responses.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toSafeUser(user);
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    if (!refreshToken?.trim()) {
      throw new BadRequestException('Refresh token is required');
    }

    await this.ensureUserExists(userId);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.ensureUserExists(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async removeRefreshToken(userId: string): Promise<void> {
    await this.ensureUserExists(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    if (!dto.firstName && !dto.lastName && !dto.phone) {
      throw new BadRequestException('At least one field must be provided');
    }

    await this.ensureUserExists(userId);

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone && existingPhone.id !== userId) {
        throw new ConflictException('Phone number already registered');
      }
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.firstName !== undefined && {
            firstName: dto.firstName.trim(),
          }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
        },
      });

      return toSafeUser(user);
    } catch (error) {
      this.handlePrismaUniqueViolation(error);
      throw error;
    }
  }

  async findAllCustomers(query: UserQueryDto): Promise<{
    data: SafeUser[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { role: Role.CUSTOMER };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map(toSafeUser),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getCustomerDetail(id: string): Promise<{
    user: SafeUser;
    recentOrders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: Prisma.Decimal;
      createdAt: Date;
    }>;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id, role: Role.CUSTOMER },
      include: {
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    const { orders, ...customer } = user;

    return {
      user: toSafeUser(customer),
      recentOrders: orders,
    };
  }

  async toggleCustomerStatus(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id, role: Role.CUSTOMER },
    });

    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    return toSafeUser(updatedUser);
  }

    async promoteToAdmin(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.ADMIN) {
      throw new ConflictException('User is already an admin');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: Role.ADMIN },
    });

    return toSafeUser(updatedUser);
  }

  async demoteToCustomer(id: string, requestingAdminId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.ADMIN) {
      throw new ConflictException('User is not an admin');
    }

    if (user.id === requestingAdminId) {
      throw new ConflictException('You cannot demote your own account');
    }

    const adminCount = await this.prisma.user.count({
      where: { role: Role.ADMIN },
    });

    if (adminCount <= 1) {
      throw new ConflictException(
        'Cannot demote the last remaining admin',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: Role.CUSTOMER },
    });

    return toSafeUser(updatedUser);
  }

  async listAdmins(): Promise<SafeUser[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN },
      orderBy: { createdAt: 'asc' },
    });
    return admins.map(toSafeUser);
  }
  async updatePassword(
    userId: string,
    newPassword: string,
  ): Promise<void> {
    await this.ensureUserExists(userId);
    const passwordHash = await bcrypt.hash(
      newPassword,
      BCRYPT_ROUNDS,
    );
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash,
      },
    });
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private handlePrismaUniqueViolation(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('User already exists');
    }
  }
}