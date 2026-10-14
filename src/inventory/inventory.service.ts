import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inventory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryDto, UpdateInventoryDto } from './dto';

export type InventoryWithAvailability = Inventory & {
  availableQuantity: number;
  isLowStock: boolean;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin: Create ─────────────────────────────────────────────────────────

  async create(dto: CreateInventoryDto): Promise<InventoryWithAvailability> {
    await this.validateProduct(dto.productId);

    const existing = await this.prisma.inventory.findUnique({
      where: { productId: dto.productId },
    });

    if (existing) {
      throw new ConflictException(
        `Inventory record already exists for product ${dto.productId}`,
      );
    }

    const inventory = await this.prisma.inventory.create({
      data: {
        productId: dto.productId,
        stockQuantity: dto.stockQuantity,
        lowStockThreshold: dto.lowStockThreshold ?? 10,
      },
      include: { product: true },
    });

    return this.withAvailability(inventory);
  }

  // ─── Admin: Find All ───────────────────────────────────────────────────────

  async findAll(): Promise<InventoryWithAvailability[]> {
    const records = await this.prisma.inventory.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(this.withAvailability);
  }

  // ─── Admin: Find One ───────────────────────────────────────────────────────

  async findOne(id: string): Promise<InventoryWithAvailability> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!inventory) {
      throw new NotFoundException(`Inventory record ${id} not found`);
    }

    return this.withAvailability(inventory);
  }

  // ─── Admin: Find By Product ────────────────────────────────────────────────

  async findByProduct(productId: string): Promise<InventoryWithAvailability> {
    await this.validateProduct(productId);

    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: { product: true },
    });

    if (!inventory) {
      throw new NotFoundException(
        `No inventory record found for product ${productId}`,
      );
    }

    return this.withAvailability(inventory);
  }

  // ─── Admin: Update ─────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateInventoryDto,
  ): Promise<InventoryWithAvailability> {
    await this.findInventory(id);

    if (
      dto.stockQuantity !== undefined &&
      dto.stockQuantity < 0
    ) {
      throw new BadRequestException(
        'Stock quantity cannot be negative',
      );
    }

    // Prevent changing productId to one that already has inventory
    if (dto.productId) {
      await this.validateProduct(dto.productId);

      const existing = await this.prisma.inventory.findUnique({
        where: { productId: dto.productId },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Inventory record already exists for product ${dto.productId}`,
        );
      }
    }

    const inventory = await this.prisma.inventory.update({
      where: { id },
      data: {
        ...(dto.productId && { productId: dto.productId }),
        ...(dto.stockQuantity !== undefined && { stockQuantity: dto.stockQuantity }),
        ...(dto.lowStockThreshold !== undefined && { lowStockThreshold: dto.lowStockThreshold }),
      },
      include: { product: true },
    });

    return this.withAvailability(inventory);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async findInventory(id: string): Promise<Inventory> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });
    if (!inventory) {
      throw new NotFoundException(
        `Inventory record ${id} not found`,
      );
    }
    return inventory;
  }

  private async validateProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.isActive) {
      throw new BadRequestException(
        `Product ${productId} does not exist or is inactive`,
      );
    }
  }

  private withAvailability(inventory: Inventory): InventoryWithAvailability {
    return {
      ...inventory,
      availableQuantity: inventory.stockQuantity,
      isLowStock: inventory.stockQuantity <= inventory.lowStockThreshold,
    };
  }
}