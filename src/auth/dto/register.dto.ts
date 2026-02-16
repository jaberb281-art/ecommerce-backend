import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ example: 'test@example.com' })
    email: string;

    @ApiProperty({ example: 'Password123!' })
    password: string;

    @ApiProperty({ example: 'Jaber Art' })
    name: string;
}