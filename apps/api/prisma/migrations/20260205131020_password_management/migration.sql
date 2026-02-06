/*
  Warnings:

  - You are about to drop the column `tokenExpiry` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verificationToken` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "tokenExpiry",
DROP COLUMN "verificationToken",
ADD COLUMN     "passwordHistory" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);
