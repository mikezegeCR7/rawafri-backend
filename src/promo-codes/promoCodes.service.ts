import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PromoCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromoCodeDto, UpdatePromoCodeDto, ValidatePromoCodeDto } from './dto';

export interface PromoValidationResult {
  code: string;
  label: string;
  discountPercent: number;
}

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromoCodeDto): Promise<PromoCode> {
    const existing = await this.prisma.promoCode.findUnique({
      where: { code: dto.code },
    });

    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) {
      throw new BadRequestException(
        'Expiry date must be in the future',
      );
    }

    if (existing) {
      throw new ConflictException(`Promo code "${dto.code}" already exists`);
    }

    return this.prisma.promoCode.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        label: dto.label,
        discountPercent: dto.discountPercent,
        maxUses: dto.maxUses,
        expiresAt,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAllAdmin(): Promise<PromoCode[]> {
    return this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllActive(): Promise<PromoCode[]> {
    return this.prisma.promoCode.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdatePromoCodeDto): Promise<PromoCode> {
    await this.findById(id);

    if (dto.code) {
      const existing = await this.prisma.promoCode.findUnique({
        where: { code: dto.code },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(`Promo code "${dto.code}" already exists`);
      }
    }

    const data: Prisma.PromoCodeUpdateInput = {};

    if (dto.code) {
      data.code = dto.code.trim().toUpperCase();
    }
    if (dto.label) data.label = dto.label;
    if (dto.discountPercent !== undefined) data.discountPercent = dto.discountPercent;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.expiresAt !== undefined) {
      const expiresAt = new Date(dto.expiresAt);
      if (expiresAt <= new Date()) {
        throw new BadRequestException(
          'Expiry date must be in the future',
        );
      }
      data.expiresAt = expiresAt;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.promoCode.update({ where: { id }, data });
  }

  async remove(id: string): Promise<{ message: string }> {
    const promo = await this.findById(id);
    if (!promo.isActive) {
      return {
        message: 'Promo code already deactivated',
      };
    }
    await this.prisma.promoCode.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
    return {
      message: 'Promo code deactivated successfully',
    };
  }

  async validate(dto: ValidatePromoCodeDto): Promise<PromoValidationResult> {
    const promo = await this.prisma.promoCode.findUnique({
      where: {
        code: dto.code.trim().toUpperCase(),
      },
    });

    if (!promo) {
      throw new NotFoundException(`Promo code "${dto.code}" not found`);
    }

    if (!promo.isActive) {
      throw new BadRequestException(`Promo code "${dto.code}" is no longer active`);
    }

    if (promo.expiresAt < new Date()) {
      throw new BadRequestException(`Promo code "${dto.code}" has expired`);
    }

    if (promo.usedCount >= promo.maxUses) {
      throw new BadRequestException(`Promo code "${dto.code}" has reached its usage limit`);
    }

    return {
      code: promo.code,
      label: promo.label,
      discountPercent: Number(promo.discountPercent),
    };
  }

  private async findById(id: string): Promise<PromoCode> {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });

    if (!promo) {
      throw new NotFoundException(`Promo code ${id} not found`);
    }

    return promo;
  }
}