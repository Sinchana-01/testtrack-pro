-- 1) Add new project scoping columns (nullable first for safe backfill)
ALTER TABLE "TestExecution" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

-- 2) Ensure a stable system user exists for bootstrap ownership
INSERT INTO "User" (
  "id",
  "name",
  "email",
  "password",
  "role",
  "isVerified",
  "isActive",
  "passwordHistory",
  "createdAt",
  "updatedAt"
)
SELECT
  '00000000-0000-4000-8000-000000000010',
  'System',
  'system.default@local.invalid',
  '$2b$10$yPWQx3Z6cFGvL6fFQ6i8rOfWTNhUQ7ovLx2nkkV8m54N5aX7d6x0m',
  'ADMIN'::"Role",
  TRUE,
  TRUE,
  ARRAY[]::TEXT[],
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE "id" = '00000000-0000-4000-8000-000000000010'
);

-- 3) Ensure default project exists
INSERT INTO "Project" (
  "id",
  "name",
  "code",
  "description",
  "isActive",
  "createdBy",
  "ownerId",
  "createdAt",
  "updatedAt"
)
SELECT
  '00000000-0000-4000-8000-000000000100',
  'Default Project',
  'DEFAULT',
  'Auto-created default project for legacy records',
  TRUE,
  COALESCE((SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1), '00000000-0000-4000-8000-000000000010'),
  COALESCE((SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1), '00000000-0000-4000-8000-000000000010'),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Project" WHERE "code" = 'DEFAULT' OR "name" = 'Default Project'
);

-- 4) Backfill nullable project-owned records
UPDATE "TestCase"
SET "projectId" = COALESCE(
  "projectId",
  (SELECT "id" FROM "Project" WHERE "code" = 'DEFAULT' OR "name" = 'Default Project' ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "projectId" IS NULL;

UPDATE "TestRun"
SET "projectId" = COALESCE(
  "projectId",
  (SELECT "id" FROM "Project" WHERE "code" = 'DEFAULT' OR "name" = 'Default Project' ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "projectId" IS NULL;

UPDATE "TestSuite"
SET "projectId" = COALESCE(
  "projectId",
  (SELECT "id" FROM "Project" WHERE "code" = 'DEFAULT' OR "name" = 'Default Project' ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "projectId" IS NULL;

UPDATE "TestExecution" te
SET "projectId" = tc."projectId"
FROM "TestCase" tc
WHERE te."projectId" IS NULL
  AND te."testCaseId" = tc."id";

UPDATE "TestExecution"
SET "projectId" = (
  SELECT "id" FROM "Project" WHERE "code" = 'DEFAULT' OR "name" = 'Default Project' ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "projectId" IS NULL;

UPDATE "Issue" i
SET "projectId" = tc."projectId"
FROM "TestCase" tc
WHERE i."projectId" IS NULL
  AND i."testCaseId" = tc."id";

UPDATE "Issue" i
SET "projectId" = te."projectId"
FROM "TestExecution" te
WHERE i."projectId" IS NULL
  AND i."executionId" = te."id";

UPDATE "Issue"
SET "projectId" = (
  SELECT "id" FROM "Project" WHERE "code" = 'DEFAULT' OR "name" = 'Default Project' ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "projectId" IS NULL;

-- 5) Enforce NOT NULL on all project-owned entities
ALTER TABLE "TestCase" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "TestRun" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "TestSuite" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "TestExecution" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "Issue" ALTER COLUMN "projectId" SET NOT NULL;

-- 6) Foreign keys for new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TestExecution_projectId_fkey'
  ) THEN
    ALTER TABLE "TestExecution"
    ADD CONSTRAINT "TestExecution_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Issue_projectId_fkey'
  ) THEN
    ALTER TABLE "Issue"
    ADD CONSTRAINT "Issue_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 7) Performance indexes
CREATE INDEX IF NOT EXISTS "TestCase_projectId_idx" ON "TestCase"("projectId");
CREATE INDEX IF NOT EXISTS "TestRun_projectId_idx" ON "TestRun"("projectId");
CREATE INDEX IF NOT EXISTS "TestSuite_projectId_idx" ON "TestSuite"("projectId");
CREATE INDEX IF NOT EXISTS "TestExecution_projectId_idx" ON "TestExecution"("projectId");
CREATE INDEX IF NOT EXISTS "Issue_projectId_idx" ON "Issue"("projectId");
CREATE UNIQUE INDEX IF NOT EXISTS "Project_code_key" ON "Project"("code");
