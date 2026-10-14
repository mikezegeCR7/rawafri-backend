import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

    private readonly productSelect = {
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
  async findAll(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: this.productSelect } },
    });

    return items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        price: item.product.price.toFixed(2),
      },
    }));
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
      include: { product: { select: this.productSelect } },
    });

    return {
      ...item,
      product: {
        ...item.product,
        price: item.product.price.toFixed(2),
      },
    };
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