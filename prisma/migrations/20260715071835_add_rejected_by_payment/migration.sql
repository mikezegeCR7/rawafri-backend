-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "rejectedById" TEXT;

-- CreateIndex
CREATE INDEX "payments_rejectedById_idx" ON "payments"("rejectedById");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
