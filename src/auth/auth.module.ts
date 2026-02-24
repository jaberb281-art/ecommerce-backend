import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import type { StringValue } from 'ms';

@Module({
  imports: [
    PrismaModule,
    ConfigModule, // Makes ConfigService available in this module
    PassportModule,

    // registerAsync ensures ConfigService is fully loaded before the JWT
    // secret is read — safe, and crashes loudly if JWT_SECRET is missing
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        // Crash on startup if secret is missing — never silently fall
        // back to a hardcoded value that could end up in git history
        if (!secret) {
          throw new Error(
            'JWT_SECRET is not defined in environment variables. ' +
            'Add JWT_SECRET=<your-secret> to your .env file.',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h') as StringValue,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule { }
