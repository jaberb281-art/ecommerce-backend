import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNumber,
    IsInt,
    IsArray,
    IsOptional,
    IsUUID,
    IsUrl,
    Min,
} from 'class-validator';

export class CreateProductDto {
    @ApiProperty({
        example: 'Victorious XIII',
        description: 'The full name of the product',
    })
    @IsString()
    name: string;

    @ApiPropertyOptional({
        example: 'Limited edition streetwear piece — Born in Bahrain.',
        description: 'Detailed product description for web and mobile views',
    })
    @IsOptional()
    @IsString()
    description?: string; // Optional — matches Prisma schema (description String?)

    @ApiProperty({ example: 6.5, description: 'Price in BHD' })
    @IsNumber()
    @Min(0, { message: 'Price cannot be negative' })
    price: number;

    @ApiProperty({ example: 10, description: 'Available units in inventory' })
    @IsInt({ message: 'Stock must be a whole number' })
    @Min(0, { message: 'Stock cannot be negative' })
    stock: number;

    @ApiProperty({
        example: [
            'https://res.cloudinary.com/demo/image/upload/v1/shbash/product1.jpg',
            'https://res.cloudinary.com/demo/image/upload/v1/shbash/product2.jpg',
        ],
        description: 'Array of Cloudinary image URLs',
    })
    @IsArray()
    @IsString({ each: true })
    @IsUrl({}, { each: true, message: 'Each image must be a valid URL' })
    images: string[];

    @ApiProperty({
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        description: 'The UUID of the category this product belongs to',
    })
    @IsUUID('4', { message: 'categoryId must be a valid UUID' })
    categoryId: string;
}