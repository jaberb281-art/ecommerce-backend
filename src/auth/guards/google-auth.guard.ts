import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Wraps Passport's Google AuthGuard to log the real error before
 * NestJS turns it into a bare 500. Without this, Vercel logs show
 * only "500" with no message or stack.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    private readonly logger = new Logger(GoogleAuthGuard.name);

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (err || !user) {
            this.logger.error('[GoogleAuthGuard] Passport error', {
                message: err?.message,
                name: err?.name,
                code: err?.code,
                oauthError: err?.oauthError,
                status: err?.status,
                info: info?.message ?? info,
                stack: err?.stack,
            });
            throw err || new UnauthorizedException('Google authentication failed');
        }
        return user;
    }
}