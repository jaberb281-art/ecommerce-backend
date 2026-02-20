// Add IsOptional to the list below
import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({ example: 'Vehicles' })
    @IsString()
    @MinLength(3)
    name: string;

    @ApiProperty({ example: 'Electric cars and SUVs', required: false })
    @IsString()
    @IsOptional()
    description?: string;
}