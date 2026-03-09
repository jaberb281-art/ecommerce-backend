import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

// Tries cookie first, falls back to Bearer header
// This means Swagger (Bearer) and Next.js frontend (cookie) both work
const cookieOrHeaderExtractor = (req: Request): string | null => {
    const fromCookie = req?.cookies?.token;
    if (fromCookie) return fromCookie;

    // Fallback for Swagger / API clients using Authorization header
    const authHeader = req?.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(configService: ConfigService) {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
            throw new Error('JWT_SECRET is not defined in environment variables.');
        }

        super({
            jwtFromRequest: cookieOrHeaderExtractor, // ← replaces fromAuthHeaderAsBearerToken
            ignoreExpiration: false,
            secretOrKey: secret,
            passReqToCallback: false,
        });
    }

    async validate(payload: JwtPayload) {
        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    }
}