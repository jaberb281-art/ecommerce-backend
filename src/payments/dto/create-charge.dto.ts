import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CheckoutPaymentMethod {
    CARD = 'card',
    APPLE_PAY = 'apple_pay',
    BENEFIT_PAY = 'benefit_pay',
}

export class CreateChargeDto {
    @ApiProperty({ description: 'Order ID returned from /orders/checkout' })
    @IsString()
    @IsNotEmpty()
    orderId!: string;

    @ApiProperty({
        enum: CheckoutPaymentMethod,
        description: 'Which method to charge through Tap',
    })
    @IsEnum(CheckoutPaymentMethod)
    method!: CheckoutPaymentMethod;
}
