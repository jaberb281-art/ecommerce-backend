import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min } from 'class-validator';

export class AddToCartDto {
    @ApiProperty({
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        description: 'The UUID of the product to add',
    })
    @IsUUID('4', { message: 'productId must be a valid UUID' })
    productId: string;

    @ApiProperty({ example: 1, description: 'Quantity to add (minimum 1)' })
    @IsInt({ message: 'Quantity must be a whole number' })
    @Min(1, { message: 'Quantity must be at least 1' })
    quantity: number;
}