import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const grains = await prisma.category.upsert({
    where: { slug: 'grains' },
    update: {},
    create: { name: 'Grains', slug: 'grains', isActive: true },
  });

  const vegetables = await prisma.category.upsert({
    where: { slug: 'vegetables' },
    update: {},
    create: { name: 'Vegetables', slug: 'vegetables', isActive: true },
  });

  const proteins = await prisma.category.upsert({
    where: { slug: 'proteins' },
    update: {},
    create: { name: 'Proteins', slug: 'proteins', isActive: true },
  });

  const testProducts = [
    { name: 'Long Grain Rice', slug: 'long-grain-rice-test', categoryId: grains.id, price: 1450 },
    { name: 'Ofada Rice', slug: 'ofada-rice-test', categoryId: grains.id, price: 1800 },
    { name: 'Yellow Garri', slug: 'yellow-garri-test', categoryId: grains.id, price: 900 },
    { name: 'Fresh Tomatoes', slug: 'fresh-tomatoes-test', categoryId: vegetables.id, price: 1200 },
    { name: 'Scotch Bonnet Pepper', slug: 'scotch-bonnet-pepper-test', categoryId: vegetables.id, price: 1500 },
    { name: 'Fresh Spinach', slug: 'fresh-spinach-test', categoryId: vegetables.id, price: 700 },
    { name: 'Smoked Fish', slug: 'smoked-fish-test', categoryId: proteins.id, price: 3500 },
    { name: 'Fresh Catfish', slug: 'fresh-catfish-test', categoryId: proteins.id, price: 4200 },
  ];

  for (const p of testProducts) {
    // Each test product is sold in one unit; real products can have several
    // (Bag, Paint, Mudu, Cup…) added from the admin panel.
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        categoryId: p.categoryId,
        isActive: true,
        units: {
          create: { name: 'Unit', price: p.price, stockQuantity: 50, lowStockThreshold: 10, minOrderQuantity: 1 },
        },
      },
    });
  }

  console.log(`Seeded ${testProducts.length} test products across 3 categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });