import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min } from 'class-validator';

export class AddToCartDto {
    @ApiProperty({
        example: 'paste-your-tesla-id-here',
        description: 'The UUID of the product'
    })
    @IsString()
    productId: string;

    @ApiProperty({ example: 1, description: 'Quantity to add' })
    @IsNumber()
    @Min(1)
    quantity: number;
}