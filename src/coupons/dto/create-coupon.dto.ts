import { DiscountType } from '@prisma/client';
import {
    IsBoolean, IsDateString, IsEnum, IsInt,
    IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min,
} from 'class-validator';

export class CreateCouponDto {
    @IsString()
    @MaxLength(50)
    @Matches(/^[A-Z0-9_-]+$/i, { message: 'Code must be alphanumeric with - or _' })
    code!: string;

    @IsEnum(DiscountType)
    discountType!: DiscountType;

    @IsPositive()
    @Max(100_000)
    discountValue!: number;

    @IsOptional()
    @IsPositive()
    minOrderValue?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    maxUses?: number;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}