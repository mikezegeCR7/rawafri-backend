-- Optional customer note per order line (e.g. "please blend the pepper").
ALTER TABLE "order_items" ADD COLUMN "note" VARCHAR(300);
