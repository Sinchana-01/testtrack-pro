-- CreateEnum
CREATE TYPE "SuiteType" AS ENUM ('STATIC', 'DYNAMIC');

-- AlterTable TestSuite
ALTER TABLE "TestSuite" ADD COLUMN "type" "SuiteType" NOT NULL DEFAULT 'STATIC';
ALTER TABLE "TestSuite" ADD COLUMN "filterJson" JSONB;

-- CreateIndex for type field
CREATE INDEX "TestSuite_type_idx" ON "TestSuite"("type");
