import {
    Body,
    Controller,
    Post,
    Patch,
    HttpCode,
    HttpStatus,
    Get,
    UseGuards,
    Request,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

interface JwtUser {
    id: string;
    email: string;
    role: string;
}
interface AuthenticatedRequest extends Request {
    user: JwtUser;
}

class UpdateProfileDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @IsOptional()
    @IsString()
    profileBg?: string;

    @IsOptional()
    @IsString()
    gender?: string;

    @IsOptional()
    @IsString()
    avatarId?: string;
}

class ChangePasswordDto {
    @IsString()
    currentPassword!: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @MaxLength(64)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    })
    newPassword!: string;
}

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @Throttle({ auth: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Register a new user account' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ auth: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Login and receive an access token' })
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    // ─── GitHub OAuth ───────────────────────────────────────────────────────

    @Get('github')
    @UseGuards(AuthGuard('github'))
    @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
    async githubAuth(@Req() req) {
        // Guard handles the redirect to GitHub
    }

    @Get('callback/github')
    @UseGuards(AuthGuard('github'))
    async githubAuthRedirect(@Req() req, @Res() res) {
        const result = await this.authService.loginWithGithub(req.user);

        const adminUrl = process.env.ADMIN_URL;
        if (!adminUrl) {
            throw new Error('[GitHub OAuth] ADMIN_URL environment variable is not set');
        }

        // Create a short-lived one-time ticket instead of setting a cross-domain cookie.
        // The admin will exchange this ticket for the real JWT on its own domain.
        const ticket = await this.authService.createExchangeToken(result.access_token);

        const redirectTo = new URL('/login-success', adminUrl);
        redirectTo.searchParams.set('ticket', ticket);
        return res.redirect(redirectTo.toString());
    }

    @Post('github/exchange')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Exchange a one-time OAuth ticket for a JWT' })
    async exchangeGithubTicket(@Body('ticket') ticket: string) {
        if (!ticket) {
            throw new UnauthorizedException('Ticket is required');
        }
        const accessToken = await this.authService.redeemExchangeToken(ticket);
        if (!accessToken) {
            throw new UnauthorizedException('Invalid or expired ticket');
        }
        return { access_token: accessToken };
    }

    // ─── Google OAuth (manual implementation, no passport) ─────────────────
    // Previously used passport-google-oauth20 but it was throwing unrecoverable
    // errors that couldn't be caught or logged. Manual flow is ~30 lines,
    // fully debuggable, and has no framework magic.

    @Get('google')
    @Public()
    @ApiOperation({ summary: 'Initiate Google OAuth login (storefront)' })
    async googleAuth(@Res() res) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
        if (!clientId || !callbackUrl) {
            return res.status(500).json({ error: 'Google OAuth not configured' });
        }

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', callbackUrl);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'openid email profile');
        authUrl.searchParams.set('access_type', 'online');
        authUrl.searchParams.set('prompt', 'select_account');

        return res.redirect(authUrl.toString());
    }

    @Get('callback/google')
    @Public()
    async googleAuthRedirect(@Req() req, @Res() res) {
        const frontendUrl = process.env.FRONTEND_URL;
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

        if (!frontendUrl || !clientId || !clientSecret || !callbackUrl) {
            return res.status(500).json({
                error: 'missing_env',
                has_frontend_url: !!frontendUrl,
                has_client_id: !!clientId,
                has_client_secret: !!clientSecret,
                has_callback_url: !!callbackUrl,
            });
        }

        const code = req.query.code as string;
        const error = req.query.error as string;

        if (error) {
            return res.status(400).json({ error: 'google_denied', detail: error });
        }
        if (!code) {
            return res.status(400).json({ error: 'no_code' });
        }

        try {
            // Step 1: Exchange code for access token
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: callbackUrl,
                    grant_type: 'authorization_code',
                }),
            });

            const tokenBody = await tokenRes.json() as any;
            if (!tokenRes.ok) {
                return res.status(500).json({
                    error: 'token_exchange_failed',
                    status: tokenRes.status,
                    body: tokenBody,
                });
            }

            const googleAccessToken: string = tokenBody.access_token;
            if (!googleAccessToken) {
                return res.status(500).json({ error: 'no_access_token', body: tokenBody });
            }

            // Step 2: Fetch user profile
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${googleAccessToken}` },
            });
            const profile = await profileRes.json() as any;
            if (!profileRes.ok) {
                return res.status(500).json({
                    error: 'profile_fetch_failed',
                    status: profileRes.status,
                    body: profile,
                });
            }

            // Step 3: Login with Google user info
            const loginResult = await this.authService.loginWithGoogle({
                email: profile.email,
                name: profile.name ?? profile.given_name ?? 'User',
                picture: profile.picture ?? null,
            });

            // Step 4: Create exchange ticket and redirect to storefront
            const ticket = await this.authService.createExchangeToken(loginResult.access_token);

            const redirectTo = new URL('/google/callback', frontendUrl);
            redirectTo.searchParams.set('ticket', ticket);
            return res.redirect(redirectTo.toString());

        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.error('[Google OAuth callback] Uncaught error:', err);
            return res.status(500).json({
                error: 'uncaught',
                message: err?.message,
                name: err?.name,
                code: err?.code,
                stack: err?.stack?.split('\n').slice(0, 6),
            });
        }
    }

    @Post('google/exchange')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Exchange a one-time Google OAuth ticket for a JWT' })
    async exchangeGoogleTicket(@Body('ticket') ticket: string) {
        if (!ticket) {
            throw new UnauthorizedException('Ticket is required');
        }
        const accessToken = await this.authService.redeemExchangeToken(ticket);
        if (!accessToken) {
            throw new UnauthorizedException('Invalid or expired ticket');
        }
        return { access_token: accessToken };
    }

    // ─── Session ────────────────────────────────────────────────────────────


    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Logout user (client deletes token)' })
    logout() {
        return { message: 'Logged out successfully' };
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current logged-in user profile' })
    async getProfile(@Request() req: AuthenticatedRequest) {
        return this.authService.getProfile(req.user.id);
    }

    /**
     * PATCH /api/auth/me
     * Updates the current user's profile (name, phone, profileBg).
     * Used by the storefront profile page.
     */
    @Patch('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update current user profile' })
    async updateProfile(
        @Request() req: AuthenticatedRequest,
        @Body() body: UpdateProfileDto,
    ) {
        return this.authService.updateProfile(req.user.id, body);
    }

    /**
     * PATCH /api/auth/me/password
     * Allows a logged-in user to change their own password by supplying
     * their current password for verification.
     */
    @Patch('me/password')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Change password (requires current password)' })
    async changePassword(
        @Request() req: AuthenticatedRequest,
        @Body() body: ChangePasswordDto,
    ) {
        return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
    }

    // ─── Password Reset ──────────────────────────────────────────────────────

    @Post('forgot-password')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Send password reset email' })
    async forgotPassword(@Body() body: { email: string }) {
        await this.authService.forgotPassword(body.email);
        return { message: 'If that email exists, a reset link has been sent.' };
    }

    @Post('reset-password')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reset password with token' })
    async resetPassword(@Body() body: { token: string; password: string }) {
        await this.authService.resetPassword(body.token, body.password);
        return { message: 'Password updated successfully.' };
    }
}