import { Injectable, UnauthorizedException } from '@nestjs/common'; // 1. Added UnauthorizedException
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service'; // Adjust path if needed

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private prisma: PrismaService) { // 2. Must have 'private' here
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'SUPER_SECRET_KEY_123',
        });
    }

    async validate(payload: any) {
        console.log('--- JWT Strategy Debug ---');
        console.log('Payload received:', payload);

        // This uses the 'prisma' we injected in the constructor
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        });

        if (!user) {
            console.log('Error: User not found in DB');
            throw new UnauthorizedException();
        }

        console.log('Success: User validated:', user.email);
        const { password, ...result } = user;
        return result;
    }
}