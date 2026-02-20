import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

// This matches your Prisma OrderStatus enum
export enum OrderStatus {
    PENDING = 'PENDING',
    SHIPPED = 'SHIPPED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export class UpdateOrderStatusDto {
    @ApiProperty({ enum: OrderStatus })
    @IsEnum(OrderStatus)
    status: OrderStatus;
}