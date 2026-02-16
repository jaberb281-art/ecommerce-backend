import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) { }

  async login(loginDto: any) {
    const { email, password } = loginDto;

    // 1. Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // 2. Check password
    if (user && (await bcrypt.compare(password, user.password))) {
      // 3. Generate JWT
      const payload = { sub: user.id, email: user.email };
      return {
        access_token: this.jwtService.sign(payload),
        user: { id: user.id, email: user.email, name: user.name },
      };
    }

    throw new UnauthorizedException('Invalid credentials');
  }
  async register(registerDto: any) {
    const { email, password, name } = registerDto;

    // 1. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Create user in database
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // 3. Return user (remove password for security)
    const { password: _, ...result } = user;
    return result;
  }
}
