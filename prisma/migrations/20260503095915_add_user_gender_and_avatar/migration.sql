/*
  Warnings:

  - A unique constraint covering the columns `[resetPasswordToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `announcementSlides` to the `ShopSettings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PointTxType" AS ENUM ('PURCHASE', 'ORDER_MILESTONE', 'CHALLENGE_REWARD', 'SOCIAL_CONNECT', 'REDEMPTION', 'MANUAL');

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "block" TEXT,
ADD COLUMN     "building" TEXT,
ALTER COLUMN "state" DROP NOT NULL,
ALTER COLUMN "zip" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "giftMessage" TEXT,
ADD COLUMN     "giftRecipientAddress" TEXT,
ADD COLUMN     "giftRecipientName" TEXT,
ADD COLUMN     "giftRecipientPhone" TEXT,
ADD COLUMN     "giftSenderName" TEXT,
ADD COLUMN     "isGift" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "announcementBgColor" TEXT DEFAULT '#18181b',
ADD COLUMN     "announcementSlides" JSONB NOT NULL,
ADD COLUMN     "announcementTextColor" TEXT DEFAULT '#ffffff',
ADD COLUMN     "bentoBestSellersLabel" TEXT NOT NULL DEFAULT 'BEST SELLERS',
ADD COLUMN     "bentoBestSellersLink" TEXT NOT NULL DEFAULT '/shop?sort=best-sellers',
ADD COLUMN     "bentoBestSellersTag" TEXT NOT NULL DEFAULT 'Top Rated',
ADD COLUMN     "bentoBestSellersVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bentoCategorySubtitle" TEXT NOT NULL DEFAULT 'Curated collections for your tech.',
ADD COLUMN     "bentoCategoryTitle" TEXT NOT NULL DEFAULT 'SHOP BY CATEGORY',
ADD COLUMN     "bentoHotDealsLabel" TEXT NOT NULL DEFAULT 'HOT DEALS',
ADD COLUMN     "bentoHotDealsLink" TEXT NOT NULL DEFAULT '/shop?sort=best-sellers',
ADD COLUMN     "bentoHotDealsTag" TEXT NOT NULL DEFAULT 'Most Popular',
ADD COLUMN     "bentoHotDealsVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bentoNewArrivalsLabel" TEXT NOT NULL DEFAULT 'NEW ARRIVALS',
ADD COLUMN     "bentoNewArrivalsLink" TEXT NOT NULL DEFAULT '/shop?sort=newest',
ADD COLUMN     "bentoNewArrivalsVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bentoSectionVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "catCtaButtonLabel" TEXT NOT NULL DEFAULT 'View All Products',
ADD COLUMN     "catCtaButtonLink" TEXT NOT NULL DEFAULT '/shop',
ADD COLUMN     "catCtaHeadline" TEXT NOT NULL DEFAULT 'Can''t find what you''re looking for?',
ADD COLUMN     "catCtaSubtext" TEXT NOT NULL DEFAULT 'Browse all products in our shop',
ADD COLUMN     "catCtaVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "catGridSubtitle" TEXT NOT NULL DEFAULT 'Choose a category to discover our carefully curated products',
ADD COLUMN     "catGridTitle" TEXT NOT NULL DEFAULT 'Explore Categories',
ADD COLUMN     "catHeroBadgeLabel" TEXT NOT NULL DEFAULT 'Browse All',
ADD COLUMN     "catHeroSubtitle" TEXT NOT NULL DEFAULT 'Find exactly what you''re looking for across our full range of premium mobile accessories and gadgets.',
ADD COLUMN     "catHeroTitle" TEXT NOT NULL DEFAULT 'Shop By Category.',
ADD COLUMN     "catHeroVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "catTrustItems" JSONB,
ADD COLUMN     "catTrustVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "clubHeadline" TEXT DEFAULT 'Discover more about the club.',
ADD COLUMN     "clubImageUrl" TEXT,
ADD COLUMN     "clubLink" TEXT DEFAULT '/profile/rewards',
ADD COLUMN     "dashboardMessage" TEXT NOT NULL DEFAULT 'Default message here',
ADD COLUMN     "heroShowProduct" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "heroTagline" TEXT NOT NULL DEFAULT 'New Arrivals',
ADD COLUMN     "heroVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "profileBannerImages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "profileCardMessage" TEXT,
ADD COLUMN     "profileCardTagline" TEXT DEFAULT 'Shbash Member';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarId" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "pointsBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "profileBg" TEXT,
ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" "PointTxType" NOT NULL,
    "description" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointTransaction_userId_idx" ON "PointTransaction"("userId");

-- CreateIndex
CREATE INDEX "PointTransaction_orderId_idx" ON "PointTransaction"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
