import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ShopSettingsService {
    constructor(private prisma: PrismaService) { }

    async getSettings() {
        return this.prisma.shopSettings.upsert({
            where: { id: 'singleton' },
            update: {},
            create: {
                id: 'singleton',
                // ✅ Required field — was missing entirely
                announcementSlides: [],
                // ✅ These match the schema exactly
                heroTitle: 'Own Your Identity.',
                heroSubtitle: 'Handcrafted phone cases. Limited drops. Express your culture.',
                heroImageUrl: 'https://placeholder.com/hero.jpg',
                heroButtonText: 'Shop Now',
                heroButtonLink: '/shop',
                bannerText: '🔥 Only 3 left! New designs dropping in 12h',
                isBannerVisible: true,
            },
        });
    }

    async updateSettings(data: {
        heroTitle?: string;
        heroSubtitle?: string;
        heroImageUrl?: string;
        heroButtonText?: string;
        heroButtonLink?: string;
        heroTagline?: string;
        heroVisible?: boolean;
        heroShowProduct?: boolean;
        bannerText?: string;
        isBannerVisible?: boolean;
        bannerBgColor?: string;
        bannerTextColor?: string;
        announcementSlides?: any[];
        announcementBgColor?: string;
        announcementTextColor?: string;
        bentoHotDealsLabel?: string;
        bentoHotDealsTag?: string;
        bentoHotDealsLink?: string;
        bentoHotDealsVisible?: boolean;
        bentoBestSellersLabel?: string;
        bentoBestSellersTag?: string;
        bentoBestSellersLink?: string;
        bentoBestSellersVisible?: boolean;
        bentoNewArrivalsLabel?: string;
        bentoNewArrivalsLink?: string;
        bentoNewArrivalsVisible?: boolean;
        bentoCategoryTitle?: string;
        bentoCategorySubtitle?: string;
        bentoSectionVisible?: boolean;
        catHeroTitle?: string;
        catHeroSubtitle?: string;
        catHeroBadgeLabel?: string;
        catHeroVisible?: boolean;
        catTrustVisible?: boolean;
        catTrustItems?: any[];
        catGridTitle?: string;
        catGridSubtitle?: string;
        catCtaVisible?: boolean;
        catCtaHeadline?: string;
        catCtaSubtext?: string;
        catCtaButtonLabel?: string;
        catCtaButtonLink?: string;
        profileBannerImages?: any[];
        profileCardTagline?: string;
    }) {
        try {
            return await this.prisma.shopSettings.update({
                where: { id: 'singleton' },
                data,
            });
        } catch (error) {
            throw new NotFoundException('Shop settings not found. Please initialize them first.');
        }
    }

    async updateHeroImage(url: string) {
        return this.prisma.shopSettings.update({
            where: { id: 'singleton' },
            data: { heroImageUrl: url },
        });
    }
}