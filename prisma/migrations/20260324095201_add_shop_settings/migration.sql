-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "heroImageUrl" TEXT NOT NULL DEFAULT 'https://placeholder.com/hero.jpg',
    "heroTitle" TEXT NOT NULL DEFAULT 'Own Your Identity.',
    "heroSubtitle" TEXT NOT NULL DEFAULT 'Handcrafted phone cases. Limited drops. Express your culture.',
    "heroButtonText" TEXT NOT NULL DEFAULT 'Shop Now',
    "heroButtonLink" TEXT NOT NULL DEFAULT '/shop',
    "bannerText" TEXT NOT NULL DEFAULT '🔥 Only 3 left! New designs dropping in 12h',
    "isBannerVisible" BOOLEAN NOT NULL DEFAULT true,
    "bannerBgColor" TEXT NOT NULL DEFAULT '#FFF7ED',
    "bannerTextColor" TEXT NOT NULL DEFAULT '#C2410C',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);
