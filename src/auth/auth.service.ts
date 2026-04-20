import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../modules/mails/mail.service';
import { User } from '@prisma/client';
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

const DUMMY_HASH = '$2b$12$L8v8R6G5U6f7H8j9K0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds: number;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {
    this.bcryptRounds = this.configService.get<number>('BCRYPT_ROUNDS') ?? 12;
  }

  // ─── OAuth Methods ────────────────────────────────────────────────────────

  async loginWithGithub(githubUser: any) {
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
          // Placeholder password for OAuth users
          password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), this.bcryptRounds),
        },
      });
      this.mailService.sendWelcomeEmail(user).catch(err =>
        this.logger.error(`Welcome email failed for ${user?.email}`, err)
      );
    }

    return this.generateTokens(user);
  }

  /**
   * Generates a short-lived (30s) ticket to safely pass the token
   * through a URL redirect without exposing the full session.
   */
  async createExchangeToken(accessToken: string): Promise<string> {
    return this.jwtService.sign(
      { sub: 'exchange', token: accessToken },
      { expiresIn: '30s' }
    );
  }

  /**
   * Exchanges the temporary ticket for the actual access token and user data.
   */
  async exchangeTicket(ticket: string) {
    try {
      const payload = this.jwtService.verify(ticket);

      if (payload.sub !== 'exchange') {
        throw new UnauthorizedException('Invalid ticket type');
      }

      const decoded = this.jwtService.decode(payload.token) as any;
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, email: true, name: true, role: true }
      });

      if (!user) throw new UnauthorizedException('User not found');

      return {
        access_token: payload.token,
        user
      };
    } catch (e) {
      throw new UnauthorizedException('Ticket expired or invalid');
    }
  }

  // ─── Standard Auth Methods ────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await bcrypt.hash(dto.password, this.bcryptRounds);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name ?? '',
        phone: dto.phone ?? '',
        username: dto.username ?? dto.email.split('@')[0],
      },
    });

    this.mailService.sendWelcomeEmail(user).catch(err =>
      this.logger.error(`Welcome email failed for ${user.email}`, err)
    );

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    const passwordToCompare = user ? user.password : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      version: user.tokenVersion
    };

    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') as any) || '24h',
      }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }

  // ─── Profile Management ───────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userBadges: { include: { badge: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const { password, resetPasswordToken, resetPasswordExpires, ...result } = user;
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

    const { password, resetPasswordToken, resetPasswordExpires, ...result } = user;
    return result;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    return { message: 'Password updated successfully' };
  }

  // ─── Password Reset ───────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Prevents timing attacks
      await bcrypt.hash(crypto.randomBytes(32).toString('hex'), this.bcryptRounds);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.user.update({
      where: { email },
      data: { resetPasswordToken: hashedToken, resetPasswordExpires: expires },
    });

    this.mailService.sendPasswordReset(user, rawToken, 30).catch(err =>
      this.logger.error(`Password reset email failed for ${email}`, err)
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) throw new UnauthorizedException('Invalid or expired reset token');

    const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        tokenVersion: { increment: 1 }
      },
    });
  }
}