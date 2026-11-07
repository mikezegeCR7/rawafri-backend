import { Prisma } from '@prisma/client';

/** Active selling units, in display order — what customers may buy. */
export const ACTIVE_UNITS = {
  where: { isActive: true },
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
} satisfies Prisma.Product$unitsArgs;

/** Compact product shape used by recently viewed, recommended and wishlist. */
export const PRODUCT_SUMMARY_SELECT = {
  id: true,
  categoryId: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  isActive: true,
  category: { select: { id: true, name: true } },
  units: {
    ...ACTIVE_UNITS,
    select: { id: true, name: true, price: true, stockQuantity: true, minOrderQuantity: true, sortOrder: true },
  },
} satisfies Prisma.ProductSelect;

type SummaryRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SUMMARY_SELECT }>;

/** Prices as fixed 2-decimal strings, matching the rest of the API. */
export function toProductSummary(product: SummaryRow) {
  return {
    ...product,
    units: product.units.map((u) => ({ ...u, price: u.price.toFixed(2) })),
  };
}
