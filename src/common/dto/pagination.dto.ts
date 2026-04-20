import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationDto {
    @ApiPropertyOptional({ minimum: 1, default: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number = 10;

    @ApiPropertyOptional({ description: 'Filter by Category ID' })
    @IsString()
    @IsOptional()
    categoryId?: string;

    @ApiPropertyOptional({ description: 'Search products by name' })
    @IsString()
    @IsOptional()
    search?: string;

    // Note: status and adminMode are intentionally NOT exposed here.
    // Public callers always receive ACTIVE products only.
    // Admin product listing uses GET /products/admin/all (guarded endpoint).
}