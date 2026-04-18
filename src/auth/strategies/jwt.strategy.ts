import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    version: number; // Added version to the payload interface
    iat?: number;
    exp?: number;
}

const cookieOrHeaderExtractor = (req: Request): string | null => {
    // Priority 1: Check HttpOnly cookies
    const fromCookie = req?.cookies?.token || req?.cookies?.access_token;
    if (fromCookie) return fromCookie;

    // Priority 2: Fallback for Bearer header (Swagger/Mobile)
    const authHeader = req?.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService, // Injected Prisma to verify session version
    ) {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
            throw new Error('JWT_SECRET is not defined in environment variables.');
        }

        super({
            jwtFromRequest: cookieOrHeaderExtractor,
            ignoreExpiration: false,
            secretOrKey: secret,
            passReqToCallback: false,
        });
    }

    /**
     * Validates the JWT and checks if the session has been revoked
     * via a tokenVersion mismatch (e.g., after a password reset).
     */
   async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, tokenVersion: true }
    });

    if (!user) {
        this.logger.warn(`JWT validation failed: User ${payload.sub} no longer exists.`);
        throw new UnauthorizedException('Session expired');
    }

    if (payload.version !== user.tokenVersion) {
        this.logger.warn(
            `Token version mismatch for user ${payload.sub}: ` +
            `Payload version (${payload.version}) != DB version (${user.tokenVersion})`
        );
        throw new UnauthorizedException('Session expired');
    }

    return user;
}
    }
}