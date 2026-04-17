import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../modules/mails/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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

  async loginWithGithub(githubUser: any) {
    // FIX: Use fallback strings to avoid 'string | undefined' error
    const email: string = githubUser.email ?? '';
    const name: string = githubUser.name ?? 'Guest User';
    const picture: string = githubUser.picture ?? '';

    if (!email) {
      throw new BadRequestException('Email is required from GitHub provider');
    }

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          profileBg: picture,
          password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12),
        },
      });
      await this.mailService.sendWelcomeEmail(user);
    }

    return this.generateTokens(user);
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name ?? '',
        phone: dto.phone ?? '',
        username: dto.username ?? dto.email.split('@')[0],
      },
    });

    await this.mailService.sendWelcomeEmail(user);
    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Timing attack protection
    const passwordToCompare = user ? user.password : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload, {
        // FIX: Non-null assertion for environment variable
        secret: this.configService.get<string>('JWT_SECRET')!,
        expiresIn: '7d',
      }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userBadges: { include: { badge: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { password, ...result } = user;
    return result;
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string; profileBg?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.profileBg !== undefined && { profileBg: data.profileBg }),
      },
      include: {
        userBadges: { include: { badge: true } },
      },
    });

    const { password, ...result } = user;
    return result;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.user.update({
      where: { email },
      data: { resetPasswordToken: token, resetPasswordExpires: expires },
    });

    await this.mailService.sendPasswordReset(user, token, 30);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) throw new UnauthorizedException('Invalid or expired reset token');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetPasswordToken: null,
        resetPasswordExpires: null
      },
    });
  }
}