import { IsString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCartItemDto {
    @ApiProperty({ example: 'clx1y2z3...', description: 'Product ID to update' })
    @IsString()
    productId: string;

    @ApiProperty({ example: 3, description: 'Exact quantity to set (0 removes the item)' })
    @IsInt()
    @Min(0)
    quantity: number;
}