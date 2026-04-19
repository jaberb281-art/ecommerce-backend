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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
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

    // ─── Public routes — no JWT token required ───────────────────────────────

    @Post('register')
    @Public()                                        // ← FIX: was missing
    @Throttle({ auth: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Register a new user account' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('login')
    @Public()                                        // ← FIX: was missing
    @HttpCode(HttpStatus.OK)
    @Throttle({ auth: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Login and receive an access token' })
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

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

    @Post('logout')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Logout user (client deletes token)' })
    logout() {
        return { message: 'Logged out successfully' };
    }

    // ─── GitHub OAuth ────────────────────────────────────────────────────────

    @Get('github')
    @Public()
    @UseGuards(AuthGuard('github'))
    @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
    async githubAuth(@Req() req) { }

    @Get('callback/github')
    @Public()
    @UseGuards(AuthGuard('github'))
    async githubAuthRedirect(@Req() req, @Res() res) {
        const result = await this.authService.loginWithGithub(req.user);
        res.cookie('access_token', result.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 8,
            path: '/',
        });
        return res.redirect(`${process.env.ADMIN_URL}/login-success`);
    }

    // ─── Authenticated routes — JWT token required ───────────────────────────

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
}