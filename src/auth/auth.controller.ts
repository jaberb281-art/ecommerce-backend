import {
    Body,
    Controller,
    Post,
    HttpCode,
    HttpStatus,
    Get,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Typed shape of req.user extracted from the JWT payload by JwtStrategy
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
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @Throttle({ auth: { limit: 5, ttl: 60000 } }) // Stricter: 5 attempts per minute
    @ApiOperation({ summary: 'Register a new user account' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ auth: { limit: 5, ttl: 60000 } }) // Stricter: 5 attempts per minute
    @ApiOperation({ summary: 'Login and receive an access token' })
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current logged-in user profile' })
    async getProfile(@Request() req: AuthenticatedRequest) {
        return this.authService.getProfile(req.user.id);
    }
}