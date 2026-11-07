import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PRODUCT_SUMMARY_SELECT, toProductSummary } from '../products/product-summary';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: PRODUCT_SUMMARY_SELECT } },
    });

    return items.map((item) => ({ ...item, product: toProductSummary(item.product) }));
  }

    async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      throw new ConflictException('Product already in wishlist');
    }

    const item = await this.prisma.wishlistItem.create({
      data: { userId, productId },
      include: { product: { select: PRODUCT_SUMMARY_SELECT } },
    });

    return { ...item, product: toProductSummary(item.product) };
  }
  async remove(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (!existing) {
      throw new NotFoundException('Item not found in wishlist');
    }

    await this.prisma.wishlistItem.delete({
      where: { userId_productId: { userId, productId } },
    });

    return { message: 'Removed from wishlist' };
  }
}