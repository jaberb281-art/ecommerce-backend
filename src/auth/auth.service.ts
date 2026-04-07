import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../modules/mails/mail.service';
import * as bcrypt from 'bcrypt';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  username?: string;
}

const DUMMY_HASH = '$2b$10$dummyhashusedtopreventtimingattacksforthistoken123456789';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) { }

  // --- UPDATED GITHUB LOGIN METHOD ---
  async loginWithGithub(githubUser: any) {
    const { email, name, picture } = githubUser;

    // 1. Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    // 2. If not, create a new user
    if (!user) {
      // Generate a random high-entropy string as a placeholder password
      const placeholderPassword = Math.random().toString(36).slice(-16) + Date.now().toString();
      const hashedPlaceholder = await bcrypt.hash(placeholderPassword, 10);

      user = await this.prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: hashedPlaceholder, // Satisfies the @required constraint in Prisma
        },
      });

      // Optional: Send welcome email to new GitHub users
      // try {
      //   await this.mailService.sendWelcomeEmail(user);
      // } catch (error) {
      //   console.error('Failed to send welcome email to GitHub user:', error);
      // }
    }

    // 3. Generate JWT
    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

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
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const { email, password, name, phone, username } = registerDto;

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    if (username) {
      const existingUsername = await this.prisma.user.findUnique({
        where: { username },
      });

      if (existingUsername) {
        throw new ConflictException({
          code: 'USERNAME_ALREADY_EXISTS',
          message: 'This username is already taken',
        });
      }
    }

    const saltRounds = parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '10'), 10);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        username,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    // try {
    //   await this.mailService.sendWelcomeEmail(user);
    // } catch (error) {
    //   console.error('Failed to send welcome email:', error);
    // }

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userBadges: {
          include: {
            badge: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User profile not found',
      });
    }

    const { password, ...result } = user;
    return result;
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
      include: {
        userBadges: {
          include: {
            badge: true
          }
        }
      }
    });

    const { password, ...result } = user;
    return result;
  }
}