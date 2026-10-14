import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BankAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
@Injectable()
export class BankAccountsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}
  async create(
    dto: CreateBankAccountDto,
  ): Promise<BankAccount> {
    const existing = await this.prisma.bankAccount.findFirst({
      where: {
        bankName: dto.bankName.trim(),
        accountNumber: dto.accountNumber.trim(),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Bank account already exists',
      );
    }
    const hasActiveAccount =
      await this.prisma.bankAccount.count({
        where: {
          isActive: true,
        },
      });
    return this.prisma.bankAccount.create({
      data: {
        bankName: dto.bankName.trim(),
        accountName: dto.accountName.trim(),
        accountNumber: dto.accountNumber.trim(),
        isActive: hasActiveAccount === 0,
      },
    });
  }
  async findAll(): Promise<BankAccount[]> {
    return this.prisma.bankAccount.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
  async findActive(): Promise<BankAccount> {
    const account =
      await this.prisma.bankAccount.findFirst({
        where: {
          isActive: true,
        },
      });
    if (!account) {
      throw new NotFoundException(
        'No active bank account configured',
      );
    }
    return account;
  }
  async update(
    id: string,
    dto: UpdateBankAccountDto,
  ): Promise<BankAccount> {
    await this.findById(id);
    if (dto.accountNumber !== undefined) {
      const existing =
        await this.prisma.bankAccount.findFirst({
          where: {
            accountNumber: dto.accountNumber.trim(),
            NOT: {
              id,
            },
          },
        });
      if (existing) {
        throw new BadRequestException(
          'Another bank account already uses this account number',
        );
      }
    }
    return this.prisma.bankAccount.update({
      where: {
        id,
      },
      data: {
        ...(dto.bankName !== undefined && {
          bankName: dto.bankName.trim(),
        }),
        ...(dto.accountName !== undefined && {
          accountName: dto.accountName.trim(),
        }),
        ...(dto.accountNumber !== undefined && {
          accountNumber: dto.accountNumber.trim(),
        }),
      },
    });
  }
  async activate(
    id: string,
  ): Promise<BankAccount> {
    const account = await this.findById(id);
    if (account.isActive) {
      return account;
    }
    await this.prisma.$transaction([
      this.prisma.bankAccount.updateMany({
        data: {
          isActive: false,
        },
      }),
      this.prisma.bankAccount.update({
        where: {
          id,
        },
        data: {
          isActive: true,
        },
      }),
    ]);
    return this.findById(id);
  }
  async remove(
    id: string,
  ): Promise<{ message: string }> {
    const account = await this.findById(id);
    if (account.isActive) {
      throw new BadRequestException(
        'Cannot delete the active bank account. Activate another account first.',
      );
    }
    await this.prisma.bankAccount.delete({
      where: {
        id,
      },
    });
    return {
      message: 'Bank account deleted successfully',
    };
  }
  private async findById(
    id: string,
  ): Promise<BankAccount> {
    const account =
      await this.prisma.bankAccount.findUnique({
        where: {
          id,
        },
      });
    if (!account) {
      throw new NotFoundException(
        'Bank account not found',
      );
    }
    return account;
  }
}