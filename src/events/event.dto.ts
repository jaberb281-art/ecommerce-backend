import { IsString, IsOptional, IsDateString, IsBoolean, IsEnum } from 'class-validator'
import { EventStatus } from '@prisma/client'

export class CreateEventDto {
    @IsString()
    title: string

    @IsOptional()
    @IsString()
    description?: string

    @IsString()
    location: string

    @IsOptional()
    @IsString()
    venue?: string

    @IsOptional()
    @IsString()
    city?: string

    @IsDateString()
    startDate: string

    @IsOptional()
    @IsDateString()
    endDate?: string

    @IsOptional()
    @IsString()
    image?: string

    @IsOptional()
    @IsEnum(EventStatus)
    status?: EventStatus

    @IsOptional()
    @IsBoolean()
    isPublished?: boolean
}

export class UpdateEventDto {
    @IsOptional()
    @IsString()
    title?: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsString()
    location?: string

    @IsOptional()
    @IsString()
    venue?: string

    @IsOptional()
    @IsString()
    city?: string

    @IsOptional()
    @IsDateString()
    startDate?: string

    @IsOptional()
    @IsDateString()
    endDate?: string

    @IsOptional()
    @IsString()
    image?: string

    @IsOptional()
    @IsEnum(EventStatus)
    status?: EventStatus

    @IsOptional()
    @IsBoolean()
    isPublished?: boolean
}