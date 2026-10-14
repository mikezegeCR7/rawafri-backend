import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Address } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dtos';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const existingCount = await this.prisma.address.count({
      where: { userId, isActive: true },
    });

    return this.prisma.address.create({
      data: {
        ...dto,
        userId,
        isDefault: existingCount === 0,
      },
    });
  }

  async findAll(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(userId: string, id: string): Promise<Address> {
    const address = await this.prisma.address.findUnique({ where: { id } });
    this.assertOwnership(address, userId, id);
    return address;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    await this.findOne(userId, id);
    return this.prisma.address.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const address = await this.findOne(userId, id);

    await this.prisma.address.update({
      where: { id },
      data: { isActive: false, isDefault: false },
    });

    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (next) {
        await this.prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return { message: 'Address removed successfully' };
  }

  async setDefault(userId: string, id: string): Promise<Address> {
    await this.findOne(userId, id);

    const [, updated] = await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, isActive: true, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return updated;
  }

  private assertOwnership(
    address: Address | null,
    userId: string,
    id: string,
  ): asserts address is Address {
    if (!address || !address.isActive) {
      throw new NotFoundException(`Address ${id} not found`);
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('You do not have access to this address');
    }
  }
}