CREATE TABLE "DeferredNotificationEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeferredNotificationEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeferredNotificationEmail_status_scheduledFor_idx" ON "DeferredNotificationEmail"("status", "scheduledFor");
CREATE INDEX "DeferredNotificationEmail_userId_status_idx" ON "DeferredNotificationEmail"("userId", "status");

ALTER TABLE "DeferredNotificationEmail"
ADD CONSTRAINT "DeferredNotificationEmail_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
