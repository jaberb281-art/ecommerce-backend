import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional, Min, IsUrl } from 'class-validator';

export class CreateProductDto {
    @ApiProperty({
        example: 'Tesla Model 3',
        description: 'The full name of the product'
    })
    @IsString()
    name: string;

    @ApiProperty({
        example: 'Dual Motor All-Wheel Drive, 0-60 mph in 3.1s',
        description: 'Detailed product description for mobile/web views'
    })
    @IsString()
    description: string;

    @ApiProperty({ example: 45000, description: 'Price in USD' })
    @IsNumber()
    @Min(0) // 🛡️ Prevents negative prices
    price: number;

    @ApiProperty({ example: 10, description: 'Available units in inventory' })
    @IsNumber()
    @Min(0) // 🛡️ Prevents negative stock
    stock: number;

    @ApiProperty({
        example: [
            'https://res.cloudinary.com/dj5jz6ydf/image/upload/v1/tesla_shop/exterior.jpg',
            'https://res.cloudinary.com/dj5jz6ydf/image/upload/v1/tesla_shop/interior.jpg'
        ],
        description: 'Array of Cloudinary image URLs',
    })
    @IsArray()
    @IsString({ each: true }) // 🛡️ Ensures every item in the array is a string
    @IsUrl({}, { each: true }) // 🛡️ Ensures they are valid URLs
    images: string[];

    @ApiProperty({
        example: 'e3b0c442-98fc-11eb-a8b3-0242ac130003',
        description: 'The UUID of the category'
    })
    @IsString()
    categoryId: string;
}