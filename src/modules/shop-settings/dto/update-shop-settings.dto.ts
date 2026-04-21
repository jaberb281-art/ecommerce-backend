import {
    IsBoolean, IsHexColor, IsOptional, IsString, IsUrl, MaxLength,
} from 'class-validator';

export class UpdateShopSettingsDto {
    @IsOptional()
    announcementSlides?: any[];

    @IsOptional()
    @IsHexColor()
    announcementBgColor?: string;

    @IsOptional()
    @IsHexColor()
    announcementTextColor?: string;

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
    @MaxLength(50)
    heroButtonText?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    heroButtonLink?: string;

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
}