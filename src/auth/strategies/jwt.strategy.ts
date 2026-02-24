import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Typed JWT payload — matches what AuthService.login() signs
// ---------------------------------------------------------------------------
interface JwtPayload {
    sub: string;   // user ID
    email: string;
    role: string;
    iat?: number;  // issued at (added automatically by JwtService)
    exp?: number;  // expiry (added automatically by JwtService)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(
        private prisma: PrismaService,
        configService: ConfigService,
    ) {
        const secret = configService.get<string>('JWT_SECRET');

        // Crash on startup if secret is missing — same guard as auth.module.ts
        if (!secret) {
            throw new Error(
                'JWT_SECRET is not defined in environment variables.',
            );
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false, // Always verify token expiry
            secretOrKey: secret,
        });
    }

    // -------------------------------------------------------------------------
    // Called by Passport after the JWT signature is verified.
    // The object returned here becomes req.user in controllers.
    //
    // NOTE: We skip the DB lookup on every request for performance.
    // The JWT is already cryptographically verified by Passport at this point.
    // If you need to guard against deleted/banned accounts, add Redis caching
    // here rather than a raw DB query on every request.
    // -------------------------------------------------------------------------
    async validate(payload: JwtPayload) {
        // Optional: uncomment to verify account still exists in DB.
        // Consider adding Redis caching if you enable this.
        //
        // const user = await this.prisma.user.findUnique({
        //     where: { id: payload.sub },
        //     select: { id: true, email: true, role: true },
        // });
        // if (!user) {
        //     this.logger.warn(`Token used for deleted account: ${payload.sub}`);
        //     throw new UnauthorizedException();
        // }
        // return user;

        // Return the payload fields as req.user — already verified by Passport
        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    }
}