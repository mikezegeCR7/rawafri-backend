import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryZone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto';

@Injectable()
export class DeliveryZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDeliveryZoneDto): Promise<DeliveryZone> {
    const existing = await this.prisma.deliveryZone.findUnique({
      where: { name: dto.name },
    });

    // Removing a zone only deactivates it; adding the same name again restores
    // it with the new fee and time rather than failing on the hidden record.
    if (existing && !existing.isActive) {
      return this.prisma.deliveryZone.update({
        where: { id: existing.id },
        data: {
          fee: Number(dto.fee.toFixed(2)),
          estimatedTime: dto.estimatedTime,
          isActive: true,
        },
      });
    }

    if (existing) {
      throw new ConflictException(
        `Delivery zone with name "${dto.name}" already exists`,
      );
    }

    return this.prisma.deliveryZone.create({
      data: {
        name: dto.name,
        fee: Number(dto.fee.toFixed(2)),
        estimatedTime: dto.estimatedTime,
      },
    });
  }

  async findAll(): Promise<DeliveryZone[]> {
    return this.prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<DeliveryZone> {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { id } });

    if (!zone || !zone.isActive) {
      throw new NotFoundException(`Delivery zone ${id} not found`);
    }

    return zone;
  }

  async update(id: string, dto: UpdateDeliveryZoneDto): Promise<DeliveryZone> {
    await this.findZone(id);

    if (dto.name) {
      const existing = await this.prisma.deliveryZone.findUnique({
        where: { name: dto.name },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Delivery zone with name "${dto.name}" already exists`,
        );
      }
    }

    return this.prisma.deliveryZone.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.fee !== undefined && {
          fee: Number(dto.fee.toFixed(2)),
        }),
        ...(dto.estimatedTime && { estimatedTime: dto.estimatedTime }),
        ...(dto.isActive !== undefined && {
          isActive: dto.isActive,
        }),
      },
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const zone = await this.findZone(id);
    if (!zone.isActive) {
      return {
        message: 'Delivery zone already deactivated',
      };
    }
    await this.prisma.deliveryZone.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
    return {
      message: 'Delivery zone deactivated successfully',
    };
  }

  private async findZone(id: string): Promise<DeliveryZone> {
    const zone = await this.prisma.deliveryZone.findUnique({
      where: { id },
    });
    if (!zone) {
      throw new NotFoundException(
        `Delivery zone ${id} not found`,
      );
    }
    return zone;
  }
}