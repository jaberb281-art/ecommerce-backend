import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBadgeDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    name!: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    description?: string;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsHexColor()
    color?: string;
}