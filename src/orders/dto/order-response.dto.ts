import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

class OrderItemResponseDto {
    @ApiProperty()
    productId!: string;

    @ApiProperty()
    quantity!: number;

    @ApiProperty()
    price!: number;
}

export class OrderResponseDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    userId!: string;

    @ApiProperty()
    total!: number;

    @ApiProperty({ enum: OrderStatus })
    status!: OrderStatus;

    @ApiProperty({ type: [OrderItemResponseDto] })
    items!: OrderItemResponseDto[];

    @ApiProperty()
    createdAt!: Date;
}