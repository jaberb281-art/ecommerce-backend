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
    Req, // Add Req
    Res, // Add Res
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // Add this import

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';

interface JwtUser {
    id: string;
    email: string;
    role: string;
}

interface AuthenticatedRequest extends Request {
    user: JwtUser;
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

    // --- NEW GITHUB ROUTES START HERE ---

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

        // ✅ Set token in httpOnly cookie (secure)
        res.cookie('access_token', result.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 8, // 8 hours
            path: '/',
        });

        // ✅ Redirect WITHOUT exposing token in URL
        return res.redirect(`${process.env.ADMIN_URL}/login-success`);
    }

    // --- NEW GITHUB ROUTES END HERE ---

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
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update current user profile' })
    async updateProfile(
        @Request() req: AuthenticatedRequest,
        @Body() body: { name?: string; phone?: string; profileBg?: string },
    ) {
        return this.authService.updateProfile(req.user.id, body);
    }

    @Post('forgot-password')
    @Public()
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() body: { email: string }) {
        await this.authService.forgotPassword(body.email);
        return { message: 'If that email exists, a reset link has been sent.' };
    }

    @Post('reset-password')
    @Public()
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() body: { token: string; password: string }) {
        await this.authService.resetPassword(body.token, body.password);
        return { message: 'Password updated successfully.' };
    }
}