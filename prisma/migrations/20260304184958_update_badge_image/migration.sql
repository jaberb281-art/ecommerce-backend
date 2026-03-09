/*
  Warnings:

  - You are about to drop the column `icon` on the `Badge` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Badge" DROP COLUMN "icon",
ADD COLUMN     "imageUrl" TEXT;
