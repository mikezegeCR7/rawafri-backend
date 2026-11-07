-- Selling units per product (Bag, Paint, Mudu, Cup…), each with its own price,
-- stock and minimum order. Replaces products.price, products.minOrderQuantity
-- and the inventory table.
--
-- Hand-written so no data is lost: every existing product becomes one unit
-- called "Unit" carrying its current price, minimum order and stock, and every
-- existing order item is linked to that unit before the old columns go.

-- 1. New table
CREATE TABLE "product_units" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "minOrderQuantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_units_pkey" PRIMARY KEY ("id")
);

-- 2. Each existing product -> one "Unit" with its current price, minimum and stock
INSERT INTO "product_units"
    ("id", "productId", "name", "price", "stockQuantity", "lowStockThreshold",
     "minOrderQuantity", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    p."id",
    'Unit',
    p."price",
    COALESCE(i."stockQuantity", 0),
    COALESCE(i."lowStockThreshold", 10),
    p."minOrderQuantity",
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "products" p
LEFT JOIN "inventory" i ON i."productId" = p."id";

-- 3. Link existing order items to their product's unit
ALTER TABLE "order_items" ADD COLUMN "unitId" TEXT;
ALTER TABLE "order_items" ADD COLUMN "unitName" TEXT;

UPDATE "order_items" oi
SET "unitId" = pu."id", "unitName" = pu."name"
FROM "product_units" pu
WHERE pu."productId" = oi."productId";

ALTER TABLE "order_items" ALTER COLUMN "unitId" SET NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "unitName" SET NOT NULL;

-- 4. Constraints and indexes
CREATE INDEX "product_units_productId_isActive_idx" ON "product_units"("productId", "isActive");
CREATE INDEX "product_units_stockQuantity_idx" ON "product_units"("stockQuantity");
CREATE UNIQUE INDEX "product_units_productId_name_key" ON "product_units"("productId", "name");

DROP INDEX "order_items_orderId_productId_key";
CREATE INDEX "order_items_unitId_idx" ON "order_items"("unitId");
CREATE UNIQUE INDEX "order_items_orderId_unitId_key" ON "order_items"("orderId", "unitId");

ALTER TABLE "product_units" ADD CONSTRAINT "product_units_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "product_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Only now remove what the units replace
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_productId_fkey";
DROP TABLE "inventory";
ALTER TABLE "products" DROP COLUMN "minOrderQuantity", DROP COLUMN "price";
