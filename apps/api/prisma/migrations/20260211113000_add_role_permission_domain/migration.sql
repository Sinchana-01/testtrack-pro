-- Add user-level admin/session fields if missing
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Enums
DO $$ BEGIN
  CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'READY', 'IN_PROGRESS', 'PASSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExecutionStatus" AS ENUM ('PASSED', 'FAILED', 'BLOCKED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttachmentType" AS ENUM ('IMAGE', 'VIDEO', 'LOG', 'DOCUMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Core tables
CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TestCase" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "steps" JSONB NOT NULL,
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "status" "TestStatus" NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT NOT NULL,
  "assignedTo" TEXT,
  "projectId" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TestSuite" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdBy" TEXT NOT NULL,
  "projectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestSuite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TestSuiteCase" (
  "id" TEXT NOT NULL,
  "suiteId" TEXT NOT NULL,
  "testCaseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestSuiteCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TestExecution" (
  "id" TEXT NOT NULL,
  "testCaseId" TEXT NOT NULL,
  "executedBy" TEXT NOT NULL,
  "result" "ExecutionStatus" NOT NULL,
  "notes" TEXT,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Attachment" (
  "id" TEXT NOT NULL,
  "testCaseId" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "fileType" "AttachmentType" NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Issue" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
  "testCaseId" TEXT,
  "executionId" TEXT,
  "reportedBy" TEXT NOT NULL,
  "assignedTo" TEXT,
  "fixNotes" TEXT,
  "commitLink" TEXT,
  "retestRequested" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IssueComment" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IssueComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SystemConfig" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BackupJob" (
  "id" TEXT NOT NULL,
  "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
  "triggeredBy" TEXT NOT NULL,
  "notes" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TestSuiteCase_suiteId_testCaseId_key" ON "TestSuiteCase"("suiteId", "testCaseId");
CREATE UNIQUE INDEX IF NOT EXISTS "SystemConfig_key_key" ON "SystemConfig"("key");

CREATE INDEX IF NOT EXISTS "TestCase_createdBy_idx" ON "TestCase"("createdBy");
CREATE INDEX IF NOT EXISTS "TestCase_assignedTo_idx" ON "TestCase"("assignedTo");
CREATE INDEX IF NOT EXISTS "TestCase_projectId_idx" ON "TestCase"("projectId");
CREATE INDEX IF NOT EXISTS "TestSuite_createdBy_idx" ON "TestSuite"("createdBy");
CREATE INDEX IF NOT EXISTS "TestSuite_projectId_idx" ON "TestSuite"("projectId");
CREATE INDEX IF NOT EXISTS "TestExecution_testCaseId_idx" ON "TestExecution"("testCaseId");
CREATE INDEX IF NOT EXISTS "TestExecution_executedBy_idx" ON "TestExecution"("executedBy");
CREATE INDEX IF NOT EXISTS "Attachment_testCaseId_idx" ON "Attachment"("testCaseId");
CREATE INDEX IF NOT EXISTS "Issue_assignedTo_idx" ON "Issue"("assignedTo");
CREATE INDEX IF NOT EXISTS "Issue_reportedBy_idx" ON "Issue"("reportedBy");
CREATE INDEX IF NOT EXISTS "IssueComment_issueId_idx" ON "IssueComment"("issueId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- FKs
DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_assignedTo_fkey"
    FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TestSuiteCase" ADD CONSTRAINT "TestSuiteCase_suiteId_fkey"
    FOREIGN KEY ("suiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TestSuiteCase" ADD CONSTRAINT "TestSuiteCase_testCaseId_fkey"
    FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_testCaseId_fkey"
    FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_executedBy_fkey"
    FOREIGN KEY ("executedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_testCaseId_fkey"
    FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Issue" ADD CONSTRAINT "Issue_testCaseId_fkey"
    FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Issue" ADD CONSTRAINT "Issue_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "TestExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reportedBy_fkey"
    FOREIGN KEY ("reportedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assignedTo_fkey"
    FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_issueId_fkey"
    FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_triggeredBy_fkey"
    FOREIGN KEY ("triggeredBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
