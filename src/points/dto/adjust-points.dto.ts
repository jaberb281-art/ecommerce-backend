import { IsInt, IsNotEmpty, IsString, NotEquals } from 'class-validator';

export class AdjustPointsDto {
    @IsInt()
    @NotEquals(0)
    points!: number;

    @IsString()
    @IsNotEmpty()
    description!: string;
}