import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsString,
    IsOptional,
    MinLength,
    MaxLength,
    Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
    @ApiProperty({ example: 'test@example.com' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @Transform(({ value }) => value?.toLowerCase().trim()) // Normalize email
    email: string;

    @ApiProperty({ example: 'Password123!', minLength: 8, maxLength: 64 })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @MaxLength(64, { message: 'Password must not exceed 64 characters' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    })
    password: string;

    @ApiPropertyOptional({ example: 'Jaber Art' })
    @IsOptional()
    @IsString()
    @MinLength(2, { message: 'Name must be at least 2 characters' })
    @MaxLength(50, { message: 'Name must not exceed 50 characters' })
    @Transform(({ value }) => value?.trim())
    name?: string; // Optional — matches the Prisma schema (name String?)
}