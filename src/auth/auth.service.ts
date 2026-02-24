import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// DTOs — replace 'any' with proper typed interfaces
// ---------------------------------------------------------------------------

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// A dummy hash used to prevent timing attacks when a user is not found.
// bcrypt.compare will always run, making response time consistent regardless
// of whether the email exists in the database.
// ---------------------------------------------------------------------------
const DUMMY_HASH = '$2b$10$dummyhashusedtopreventtimingattacksforthistoken123456789';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  // -----------------------------------------------------------------------
  // LOGIN
  // -----------------------------------------------------------------------

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always run bcrypt.compare even if user not found — prevents timing
    // attacks that could be used to enumerate valid email addresses
    const passwordToCompare = user?.password ?? DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordToCompare);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role, // Include role so frontend can render admin UI
      },
    };
  }

  // -----------------------------------------------------------------------
  // REGISTER
  // -----------------------------------------------------------------------

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // Check for existing email and return a clean 409 instead of a raw
    // Prisma P2002 unique constraint error bubbling up as a 500
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    // Salt rounds from config so they can be tuned per environment
    // parseInt is required — env vars are always strings, bcrypt requires a number
    const saltRounds = parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '10'), 10);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await this.prisma.user.create({
      data: { email, password: hashedPassword, name },
      // Use select instead of destructuring — safer, never accidentally
      // returns new sensitive fields added to the model in future
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  // -----------------------------------------------------------------------
  // GET PROFILE
  // -----------------------------------------------------------------------

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Return 404 instead of silently returning null for deleted/invalid accounts
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User profile not found',
      });
    }

    return user;
  }
}