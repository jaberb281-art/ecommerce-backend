import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRefundDto {
    @ApiProperty({ description: 'Order ID to refund' })
    @IsString()
    @IsNotEmpty()
    orderId!: string;

    @ApiPropertyOptional({
        description: 'Refund amount in BHD. Omit for a full refund of the remaining balance.',
        example: 5.5,
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    amount?: number;

    @ApiPropertyOptional({ description: 'Reason for the refund (audit only)' })
    @IsOptional()
    @IsString()
    reason?: string;
}
