import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Ensure this path matches your project structure

@Injectable()
export class ShopSettingsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Fetches the current shop configuration.
     * If no settings exist yet, it creates the initial 'singleton' record with defaults.
     */
    async getSettings() {
        return this.prisma.shopSettings.upsert({
            where: { id: 'singleton' },
            update: {}, // Do nothing if it exists
            create: {
                id: 'singleton',
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

    /**
     * Updates the shop settings.
     * This handles both text changes and the new image URL from your upload service.
     */
    async updateSettings(data: {
        heroTitle?: string;
        heroSubtitle?: string;
        heroImageUrl?: string;
        heroButtonText?: string;
        heroButtonLink?: string;
        bannerText?: string;
        isBannerVisible?: boolean;
        bannerBgColor?: string;
        bannerTextColor?: string;
    }) {
        try {
            return await this.prisma.shopSettings.update({
                where: { id: 'singleton' },
                data,
            });
        } catch (error) {
            // If for some reason the singleton hasn't been created yet
            throw new NotFoundException('Shop settings not found. Please initialize them first.');
        }
    }

    /**
     * Specifically updates only the Hero Image URL.
     * Useful when calling from an Image Upload Controller.
     */
    async updateHeroImage(url: string) {
        return this.prisma.shopSettings.update({
            where: { id: 'singleton' },
            data: { heroImageUrl: url },
        });
    }
}