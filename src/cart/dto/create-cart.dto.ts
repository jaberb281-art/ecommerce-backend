import { IsString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
    @ApiProperty({ example: 'paste-product-id-here' })
    @IsString()
    productId: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Min(1)
    quantity: number;
}