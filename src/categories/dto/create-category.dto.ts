import { IsString, IsOptional, IsUrl, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({
        example: 'Stickers',
        description: 'The name of the category (must be unique)',
    })
    @IsString()
    @MinLength(2, { message: 'Category name must be at least 2 characters' })
    @MaxLength(50, { message: 'Category name must not exceed 50 characters' })
    name: string;

    @ApiPropertyOptional({
        example: 'https://example.com/image.jpg',
        description: 'Optional image URL for the category',
    })
    @IsOptional()
    @IsUrl({}, { message: 'Image must be a valid URL' })
    image?: string;
}