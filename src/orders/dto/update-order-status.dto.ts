import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client'; // Single source of truth — never redefine this

export class UpdateOrderStatusDto {
    @ApiProperty({
        enum: OrderStatus,
        example: OrderStatus.SHIPPED,
        description: 'Valid transitions: PENDING → SHIPPED or CANCELLED, SHIPPED → COMPLETED',
    })
    @IsEnum(OrderStatus, {
        message: `Status must be one of: ${Object.values(OrderStatus).join(', ')}`,
    })
    status: OrderStatus;
}