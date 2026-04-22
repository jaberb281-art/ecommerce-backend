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

    // ─── Google OAuth ────────────────────────────────────────────────────────

    @Get('google')
    @UseGuards(AuthGuard('google'))
    @Public()
    @ApiOperation({ summary: 'Initiate Google OAuth login (storefront)' })
    async googleAuth(@Req() req) {
        // Guard handles the redirect to Google
    }

    @Get('callback/google')
    @UseGuards(AuthGuard('google'))
    @Public()
    async googleAuthRedirect(@Req() req, @Res() res) {
        const frontendUrl = process.env.FRONTEND_URL;
        if (!frontendUrl) {
            throw new Error('[Google OAuth] FRONTEND_URL environment variable is not set');
        }

        try {
            const result = await this.authService.loginWithGoogle(req.user);
            const ticket = await this.authService.createExchangeToken(result.access_token);

            const redirectTo = new URL('/auth/google/callback', frontendUrl);
            redirectTo.searchParams.set('ticket', ticket);
            return res.redirect(redirectTo.toString());
        } catch (err: any) {
            // Log the full error server-side so Vercel captures it with a stack trace
            // eslint-disable-next-line no-console
            console.error('[Google OAuth callback] Failed:', {
                message: err?.message,
                name: err?.name,
                code: err?.code,
                meta: err?.meta,
                stack: err?.stack,
            });

            // Redirect back to login with a friendly error code so the UI can show a message
            const errorRedirect = new URL('/login', frontendUrl);
            errorRedirect.searchParams.set('error', 'google_signin_failed');
            return res.redirect(errorRedirect.toString());
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