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
            const details = {
                message: err?.message,
                name: err?.name,
                code: err?.code,
                status: err?.status,
                oauthError: err?.oauthError,
                info: info?.message ?? info,
                stack: err?.stack,
            };
            // Use console.error + JSON.stringify so Vercel logs serialize it visibly
            // eslint-disable-next-line no-console
            console.error('[GoogleAuthGuard] Passport error:', JSON.stringify(details, null, 2));
            throw err || new UnauthorizedException('Google authentication failed');
        }
        return user;
    }
}