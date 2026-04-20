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

        // Generate a short-lived exchange ticket instead of setting a cookie directly
        const exchangeToken = await this.authService.createExchangeToken(result.access_token);

        // Redirect to admin login-success with the ticket
        const redirectTo = new URL('/login-success', adminUrl);
        redirectTo.searchParams.set('ticket', exchangeToken);

        return res.redirect(redirectTo.toString());
    }

    @Post('github/exchange')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Exchange GitHub ticket for real access token' })
    async exchangeGithubTicket(@Body() body: { ticket: string }) {
        // Implement `exchangeTicket` in your AuthService to validate the ticket,
        // burn it so it can't be reused, and return the actual user data and access_token.
        return this.authService.exchangeTicket(body.ticket);
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