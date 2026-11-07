import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product, ProductUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../common/storage/r2-storage.service';
import { CreateProductDto, ProductUnitDto, UpdateProductDto, UpdateUnitStockDto } from './dto';
import { requireImage } from '../common/upload/image-file';
import { ACTIVE_UNITS, PRODUCT_SUMMARY_SELECT, toProductSummary } from './product-summary';

/** Customers: category plus active units only. */
const PUBLIC_INCLUDE = { category: true, units: ACTIVE_UNITS } satisfies Prisma.ProductInclude;

/** Admins: every unit, including switched-off ones. */
const ADMIN_INCLUDE = {
  category: true,
  units: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.ProductInclude;

/** A product is only for sale while it has at least one active unit. */
const HAS_ACTIVE_UNIT = { units: { some: { isActive: true } } } satisfies Prisma.ProductWhereInput;

const money = (n: number) => Number(n.toFixed(2));

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: R2StorageService,
  ) {}

  // ─── Admin: Upload Product Image ───────────────────────────────────────────

  async uploadImage(file: Express.Multer.File): Promise<{ imageUrl: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const image = requireImage(file);
    const key = `products/${Date.now()}-${Math.round(Math.random() * 1e9)}.${image.extension}`;
    const imageUrl = await this.storageService.uploadFile(
      file.buffer,
      key,
      image.contentType,
    );

    return { imageUrl };
  }

  // ─── Admin: Create ─────────────────────────────────────────────────────────

  async create(dto: CreateProductDto): Promise<Product> {
    await this.validateCategory(dto.categoryId);
    await this.checkSlugUnique(dto.slug);
    this.assertUniqueUnitNames(dto.units);

    return this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive ?? true,
        units: {
          create: dto.units.map((u, i) => this.unitData(u, i)),
        },
      },
      include: ADMIN_INCLUDE,
    });
  }

  // ─── Public: Find All Active ───────────────────────────────────────────────

  async findAll(): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { isActive: true, category: { isActive: true }, ...HAS_ACTIVE_UNIT },
      include: PUBLIC_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  // ─── Admin: Find All (including inactive/unpublished) ──────────────────────

  async findAllAdmin(): Promise<Product[]> {
    return this.prisma.product.findMany({
      include: ADMIN_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  // ─── Public: Find One Active ───────────────────────────────────────────────

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PUBLIC_INCLUDE,
    });

    if (!product || !product.isActive || product.units.length === 0) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  // ─── Public: Find By Category ──────────────────────────────────────────────

  async findByCategory(categoryId: string): Promise<Product[]> {
    await this.validateCategory(categoryId);

    return this.prisma.product.findMany({
      where: { categoryId, isActive: true, ...HAS_ACTIVE_UNIT },
      include: PUBLIC_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  // ─── Admin: Update ─────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.findProduct(id);

    if (dto.categoryId) {
      await this.validateCategory(dto.categoryId);
    }

    if (dto.slug) {
      await this.checkSlugUnique(dto.slug, id);
    }

    if (dto.units) {
      this.assertUniqueUnitNames(dto.units);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(dto.categoryId && { categoryId: dto.categoryId }),
          ...(dto.name && { name: dto.name }),
          ...(dto.slug && { slug: dto.slug }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      if (dto.units) {
        await this.syncUnits(tx, id, dto.units);
      }

      return tx.product.findUniqueOrThrow({ where: { id }, include: ADMIN_INCLUDE });
    });
  }

  // ─── Admin: Stock for one unit (Inventory page) ────────────────────────────

  async updateUnitStock(productId: string, unitId: string, dto: UpdateUnitStockDto): Promise<ProductUnit> {
    const unit = await this.prisma.productUnit.findUnique({ where: { id: unitId } });
    if (!unit || unit.productId !== productId) {
      throw new NotFoundException('Selling unit not found for this product');
    }

    return this.prisma.productUnit.update({
      where: { id: unitId },
      data: {
        ...(dto.stockQuantity !== undefined && { stockQuantity: dto.stockQuantity }),
        ...(dto.lowStockThreshold !== undefined && { lowStockThreshold: dto.lowStockThreshold }),
      },
    });
  }

  // ─── Admin: Soft Delete ────────────────────────────────────────────────────

  async remove(id: string): Promise<{ message: string }> {
    const product = await this.findProduct(id);
    if (!product.isActive) {
      return {
        message: 'Product already deactivated',
      };
    }
    await this.prisma.product.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
    return {
      message: 'Product deactivated successfully',
    };
  }

  // ─── Recently Viewed ────────────────────────────────────────────────────────

  async logView(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.productView.upsert({
      where: { userId_productId: { userId, productId } },
      update: { viewedAt: new Date() },
      create: { userId, productId },
    });

    return { message: 'View logged' };
  }

  async getRecentlyViewed(userId: string) {
    const views = await this.prisma.productView.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
      take: 20,
      include: { product: { select: PRODUCT_SUMMARY_SELECT } },
    });

    return views.map((view) => ({ ...view, product: toProductSummary(view.product) }));
  }

  // ─── Recommended ────────────────────────────────────────────────────────────

  async getRecommended(userId: string) {
    const RECOMMENDATION_LIMIT = 10;

    const purchasedItems = await this.prisma.orderItem.findMany({
      where: { order: { customerId: userId } },
      select: { productId: true, product: { select: { categoryId: true } } },
      distinct: ['productId'],
    });

    const categoryIds = [
      ...new Set(purchasedItems.map((item) => item.product.categoryId)),
    ];
    const purchasedProductIds = purchasedItems.map((item) => item.productId);

    const forSale = { isActive: true, category: { isActive: true }, ...HAS_ACTIVE_UNIT } satisfies Prisma.ProductWhereInput;
    let products: Prisma.ProductGetPayload<{ select: typeof PRODUCT_SUMMARY_SELECT }>[];

    if (categoryIds.length > 0) {
      products = await this.prisma.product.findMany({
        where: {
          ...forSale,
          categoryId: { in: categoryIds },
          id: { notIn: purchasedProductIds },
        },
        select: PRODUCT_SUMMARY_SELECT,
        orderBy: { createdAt: 'desc' },
        take: RECOMMENDATION_LIMIT,
      });

      // A returning customer with a narrow purchase history might not have
      // enough same-category products left to fill the list — top up with
      // newest active products rather than showing a half-empty section.
      if (products.length < RECOMMENDATION_LIMIT) {
        const excludeIds = [
          ...purchasedProductIds,
          ...products.map((p) => p.id),
        ];
        const topUp = await this.prisma.product.findMany({
          where: { ...forSale, id: { notIn: excludeIds } },
          select: PRODUCT_SUMMARY_SELECT,
          orderBy: { createdAt: 'desc' },
          take: RECOMMENDATION_LIMIT - products.length,
        });
        products = [...products, ...topUp];
      }
    } else {
      // No order history — honest fallback: newest active products.
      products = await this.prisma.product.findMany({
        where: forSale,
        select: PRODUCT_SUMMARY_SELECT,
        orderBy: { createdAt: 'desc' },
        take: RECOMMENDATION_LIMIT,
      });
    }

    return products.map(toProductSummary);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private unitData(u: ProductUnitDto, index: number) {
    return {
      name: u.name,
      price: money(u.price),
      stockQuantity: u.stockQuantity,
      lowStockThreshold: u.lowStockThreshold ?? 5,
      minOrderQuantity: u.minOrderQuantity ?? 1,
      sortOrder: u.sortOrder ?? index,
      isActive: true,
    };
  }

  private assertUniqueUnitNames(units: ProductUnitDto[]): void {
    const seen = new Set<string>();
    for (const u of units) {
      const key = u.name.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(`Two selling units are both called "${u.name}". Give each one a different name.`);
      }
      seen.add(key);
    }
  }

  /**
   * Makes the product's units match the list from the admin form:
   * - a unit with an id is updated (and switched back on if it was off);
   * - a unit without an id reuses a switched-off unit of the same name, or is
   *   created — so re-adding "Mudu" brings back the old record and its history;
   * - existing units not in the list are switched off, never deleted, because
   *   past orders point at them.
   */
  private async syncUnits(tx: Prisma.TransactionClient, productId: string, units: ProductUnitDto[]): Promise<void> {
    const existing = await tx.productUnit.findMany({ where: { productId } });
    const byId = new Map(existing.map((e) => [e.id, e]));
    // Name matching only considers units no listed unit claims by id — otherwise
    // renaming "Cup" -> "Paint" while adding a new "Cup" would grab the same row twice.
    const claimedIds = new Set(units.flatMap((u) => (u.id ? [u.id] : [])));
    const byName = new Map(
      existing.filter((e) => !claimedIds.has(e.id)).map((e) => [e.name.toLowerCase(), e]),
    );

    const plan = units.map((u, index) => {
      if (u.id) {
        const target = byId.get(u.id);
        if (!target) throw new BadRequestException(`Selling unit ${u.id} doesn't belong to this product`);
        return { dto: u, index, target };
      }
      return { dto: u, index, target: byName.get(u.name.toLowerCase()) };
    });

    const kept = new Set(plan.flatMap((p) => (p.target ? [p.target.id] : [])));
    const wantedNames = new Set(units.map((u) => u.name.toLowerCase()));

    // Units being dropped: switch off, and move aside any whose name a listed
    // unit is about to take, so the (productId, name) uniqueness holds.
    for (const e of existing) {
      if (kept.has(e.id)) continue;
      await tx.productUnit.update({
        where: { id: e.id },
        data: {
          isActive: false,
          ...(wantedNames.has(e.name.toLowerCase()) && { name: `${e.name} (old ${e.id.slice(0, 6)})` }),
        },
      });
    }

    // Two-step rename so swapping names between units can't collide.
    for (const p of plan) {
      if (p.target) {
        await tx.productUnit.update({ where: { id: p.target.id }, data: { name: `__renaming__${p.target.id}` } });
      }
    }

    for (const p of plan) {
      const data = this.unitData(p.dto, p.index);
      if (p.target) {
        await tx.productUnit.update({ where: { id: p.target.id }, data });
      } else {
        await tx.productUnit.create({ data: { ...data, productId } });
      }
    }
  }

  private async findProduct(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  private async validateCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || !category.isActive) {
      throw new BadRequestException(
        `Category ${categoryId} does not exist or is inactive`,
      );
    }
  }

  private async checkSlugUnique(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { slug } });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Product slug "${slug}" already exists`);
    }
  }
}
