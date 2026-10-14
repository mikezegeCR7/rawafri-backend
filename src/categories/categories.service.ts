import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin: Create ─────────────────────────────────────────────────────────

  async create(dto: CreateCategoryDto): Promise<Category> {
    // Removing a category only deactivates it. Adding it again (same name or
    // slug) restores that record with the new details instead of failing
    // with "already exists" for something the admin can no longer see.
    const removed = await this.prisma.category.findFirst({
      where: { isActive: false, OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (removed) {
      await this.checkUnique(dto.name, dto.slug, removed.id);
      return this.prisma.category.update({
        where: { id: removed.id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          imageUrl: dto.imageUrl ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: true,
        },
      });
    }

    await this.checkUnique(dto.name, dto.slug);

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  // ─── Public: Find All Active ───────────────────────────────────────────────

  async findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // ─── Public: Find One Active ───────────────────────────────────────────────

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category || !category.isActive) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return category;
  }

  // ─── Admin: Update ─────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findCategory(id);

    if (dto.name || dto.slug) {
      await this.checkUnique(dto.name, dto.slug, id);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ─── Admin: Soft Delete ────────────────────────────────────────────────────

  async remove(id: string): Promise<{ message: string }> {
    const category = await this.findCategory(id);
    if (!category.isActive) {
      return {
        message: 'Category already deactivated',
      };
    }
    await this.prisma.category.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
    return {
      message: 'Category deactivated successfully',
    };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async findCategory(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  private async checkUnique(
    name?: string,
    slug?: string,
    excludeId?: string,
  ): Promise<void> {
    if (name) {
      const existing = await this.prisma.category.findUnique({
        where: { name },
      });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(`Category name "${name}" already exists`);
      }
    }

    if (slug) {
      const existing = await this.prisma.category.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(`Category slug "${slug}" already exists`);
      }
    }
  }
}