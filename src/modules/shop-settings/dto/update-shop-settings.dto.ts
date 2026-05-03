import {
    IsArray,
    IsBoolean,
    IsHexColor,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Allows safe relative paths (/shop) or absolute https:// URLs.
// Rejects javascript:, data:, and other dangerous schemes at the DTO boundary.
const SAFE_URL = /^(\/[^\s]*|https:\/\/[^\s]+)$/;

class AnnouncementSlideDto {
    @IsString()
    @MaxLength(200)
    text!: string;

    @IsOptional()
    @IsString()
    @Matches(SAFE_URL, { message: 'link must be a safe URL' })
    link?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    linkLabel?: string;
}

class TrustItemDto {
    @IsOptional()
    @IsString()
    @MaxLength(50)
    icon?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    title?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    sub?: string;
}

export class UpdateShopSettingsDto {
    // ── Announcement bar ──────────────────────────────────────────────────────
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AnnouncementSlideDto)
    announcementSlides?: AnnouncementSlideDto[];

    @IsOptional()
    @IsHexColor()
    announcementBgColor?: string;

    @IsOptional()
    @IsHexColor()
    announcementTextColor?: string;

    // ── Hero ──────────────────────────────────────────────────────────────────
    @IsOptional()
    @IsString()
    @MaxLength(200)
    heroTitle?: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    heroSubtitle?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    heroImageUrl?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    heroButtonText?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    @Matches(SAFE_URL, { message: 'heroButtonLink must be a safe URL' })
    heroButtonLink?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    heroTagline?: string;

    @IsOptional()
    @IsBoolean()
    heroVisible?: boolean;

    @IsOptional()
    @IsBoolean()
    heroShowProduct?: boolean;

    // ── Banner ────────────────────────────────────────────────────────────────
    @IsOptional()
    @IsString()
    @MaxLength(200)
    bannerText?: string;

    @IsOptional()
    @IsBoolean()
    isBannerVisible?: boolean;

    @IsOptional()
    @IsHexColor()
    bannerBgColor?: string;

    @IsOptional()
    @IsHexColor()
    bannerTextColor?: string;

    // ── Bento grid ────────────────────────────────────────────────────────────
    @IsOptional()
    @IsString()
    @MaxLength(100)
    bentoCategoryTitle?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    bentoCategorySubtitle?: string;

    @IsOptional()
    @IsBoolean()
    bentoSectionVisible?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    bentoHotDealsLabel?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    bentoHotDealsTag?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    @Matches(SAFE_URL, { message: 'bentoHotDealsLink must be a safe URL' })
    bentoHotDealsLink?: string;

    @IsOptional()
    @IsBoolean()
    bentoHotDealsVisible?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    bentoBestSellersLabel?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    bentoBestSellersTag?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    @Matches(SAFE_URL, { message: 'bentoBestSellersLink must be a safe URL' })
    bentoBestSellersLink?: string;

    @IsOptional()
    @IsBoolean()
    bentoBestSellersVisible?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    bentoNewArrivalsLabel?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    @Matches(SAFE_URL, { message: 'bentoNewArrivalsLink must be a safe URL' })
    bentoNewArrivalsLink?: string;

    @IsOptional()
    @IsBoolean()
    bentoNewArrivalsVisible?: boolean;

    // ── Categories page ───────────────────────────────────────────────────────
    @IsOptional()
    @IsString()
    @MaxLength(100)
    catHeroTitle?: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    catHeroSubtitle?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    catHeroBadgeLabel?: string;

    @IsOptional()
    @IsBoolean()
    catHeroVisible?: boolean;

    @IsOptional()
    @IsBoolean()
    catTrustVisible?: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TrustItemDto)
    catTrustItems?: TrustItemDto[];

    @IsOptional()
    @IsString()
    @MaxLength(100)
    catGridTitle?: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    catGridSubtitle?: string;

    @IsOptional()
    @IsBoolean()
    catCtaVisible?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    catCtaHeadline?: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    catCtaSubtext?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    catCtaButtonLabel?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    @Matches(SAFE_URL, { message: 'catCtaButtonLink must be a safe URL' })
    catCtaButtonLink?: string;

    // ── Profile ───────────────────────────────────────────────────────────────
    @IsOptional()
    @IsArray()
    profileBannerImages?: string[];

    @IsOptional()
    @IsString()
    @MaxLength(100)
    profileCardTagline?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    profileCardMessage?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    dashboardMessage?: string;

    // ── Club section ──────────────────────────────────────────────────────────
    @IsOptional()
    @IsString()
    @MaxLength(500)
    clubImageUrl?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    clubHeadline?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    @Matches(SAFE_URL, { message: 'clubLink must be a safe URL' })
    clubLink?: string;
}