import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class OrderItemDto {
    @ApiProperty({ example: 'clx1y2z3...' })
    @IsString()
    @IsNotEmpty()
    productId: string;

    @ApiProperty({ example: 1 })
    @IsNumber()
    @Min(1)
    quantity: number;
}

export enum ShippingMethod {
    EXPRESS = 'express',
    STANDARD = 'standard',
    PICKUP = 'pickup',
}

export enum PaymentMethod {
    CREDIT = 'credit',
    APPLEPAY = 'applepay',
    CASH = 'cash',
}

export class CreateOrderDto {
    @ApiPropertyOptional({
        type: [OrderItemDto],
        description: 'Items to order — if omitted, backend uses current cart items',
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items?: OrderItemDto[];

    @ApiPropertyOptional({ enum: ShippingMethod, example: ShippingMethod.STANDARD })
    @IsOptional()
    @IsEnum(ShippingMethod)
    shippingMethod?: ShippingMethod;

    @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.CASH })
    @IsOptional()
    @IsEnum(PaymentMethod)
    paymentMethod?: PaymentMethod;

    @ApiPropertyOptional({ example: 'coupon-uuid' })
    @IsOptional()
    @IsString()
    couponId?: string;

    @ApiPropertyOptional({ example: 'SAVE10' })
    @IsOptional()
    @IsString()
    couponCode?: string;
}