import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../common/storage/r2-storage.service';
import { CreateProductDto, UpdateProductDto } from './dto';
type ProductWithRelations = Product & {
  category: { id: string; name: string };
  inventory: { stockQuantity: number } | null;
};

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

    const extension = file.originalname.split('.').pop() ?? 'jpg';
    const key = `products/${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;
    const imageUrl = await this.storageService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    return { imageUrl };
  }

  // ─── Admin: Create ─────────────────────────────────────────────────────────

  async create(dto: CreateProductDto): Promise<Product> {
    await this.validateCategory(dto.categoryId);
    await this.checkSlugUnique(dto.slug);

    return this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        price: Number(dto.price.toFixed(2)),
        imageUrl: dto.imageUrl,
        minOrderQuantity: dto.minOrderQuantity ?? 1,
        isActive: dto.isActive ?? true,
      },
      include: { category: true, inventory: true },
    });
  }

  // ─── Public: Find All Active ───────────────────────────────────────────────

  async findAll(): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { isActive: true, category: { isActive: true } },
      include: { category: true, inventory: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Admin: Find All (including inactive/unpublished) ──────────────────────

  async findAllAdmin(): Promise<Product[]> {
    return this.prisma.product.findMany({
      include: { category: true, inventory: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Public: Find One Active ───────────────────────────────────────────────

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, inventory: true },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  // ─── Public: Find By Category ──────────────────────────────────────────────

  async findByCategory(categoryId: string): Promise<Product[]> {
    await this.validateCategory(categoryId);

    return this.prisma.product.findMany({
      where: { categoryId, isActive: true },
      include: { category: true, inventory: true },
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

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && {
          price: Number(dto.price.toFixed(2)),
        }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.minOrderQuantity !== undefined && { minOrderQuantity: dto.minOrderQuantity }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true, inventory: true },
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

  private readonly recentlyViewedProductSelect = {
    id: true,
    categoryId: true,
    name: true,
    slug: true,
    description: true,
    price: true,
    imageUrl: true,
    minOrderQuantity: true,
    isActive: true,
    category: { select: { id: true, name: true } },
    inventory: { select: { stockQuantity: true } },
  };

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
      include: { product: { select: this.recentlyViewedProductSelect } },
    });

    return views.map((view) => ({
      ...view,
      product: {
        ...view.product,
        price: view.product.price.toFixed(2),
      },
    }));
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

        let products: ProductWithRelations[];

    if (categoryIds.length > 0) {
      products = await this.prisma.product.findMany({
        where: {
          isActive: true,
          category: { isActive: true },
          categoryId: { in: categoryIds },
          id: { notIn: purchasedProductIds },
        },
        include: { category: true, inventory: true },
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
          where: {
            isActive: true,
            category: { isActive: true },
            id: { notIn: excludeIds },
          },
          include: { category: true, inventory: true },
          orderBy: { createdAt: 'desc' },
          take: RECOMMENDATION_LIMIT - products.length,
        });
        products = [...products, ...topUp];
      }
    } else {
      // No order history — honest fallback: newest active products.
      products = await this.prisma.product.findMany({
        where: { isActive: true, category: { isActive: true } },
        include: { category: true, inventory: true },
        orderBy: { createdAt: 'desc' },
        take: RECOMMENDATION_LIMIT,
      });
    }

    return products.map((product) => ({
      ...product,
      price: product.price.toFixed(2),
    }));
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async findProduct(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        inventory: true,
      },
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