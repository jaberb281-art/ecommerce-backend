import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
    @ApiProperty({ example: 'test@example.com' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @Transform(({ value }) => value?.toLowerCase().trim()) // Normalize to match registration
    email: string;

    @ApiProperty({ example: 'Password123!' })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @MaxLength(64, { message: 'Password must not exceed 64 characters' })
    password: string;
}