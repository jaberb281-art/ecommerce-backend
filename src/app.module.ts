import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { CategoriesModule } from './categories/categories.module';
import { UsersModule } from './users/users.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { CouponsModule } from './coupons/coupons.module';
import { BadgesModule } from './badges/badges.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AddressesModule } from './addresses/addresses.module';
import { EventsModule } from './events/events.module';
import { ShopSettingsModule } from './modules/shop-settings/shop-settings.module';
import { PointsModule } from './points/points.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // ─── Rate limiting ───────────────────────────────────────────────────────
    // 'general' bucket: all routes — 200 req/min per IP
    // 'auth'    bucket: login/register — 10 req/min per IP
    //
    // To raise limits for local development, set these env vars:
    //   THROTTLE_GENERAL_LIMIT=10000
    //   THROTTLE_AUTH_LIMIT=100
    // They are read below and fall back to the production-safe defaults.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [],
      useFactory: () => ([
        {
          name: 'general',
          ttl: 60_000,
          limit: parseInt(process.env.THROTTLE_GENERAL_LIMIT ?? '200', 10),
        },
        {
          name: 'auth',
          ttl: 60_000,
          limit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '10', 10),
        },
      ]),
    }),

    PrismaModule,
    AuthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    CategoriesModule,
    UsersModule,
    CouponsModule,
    BadgesModule,
    NotificationsModule,
    AnalyticsModule,
    AddressesModule,
    EventsModule,
    ShopSettingsModule,
    PointsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // ── Global rate limiter (all routes) ────────────────────────────────────
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // ── Global JWT guard (all routes, respects @Public() decorator) ─────────
    // This is what was MISSING — without this, JwtAuthGuard was only active
    // on routes that explicitly declared @UseGuards(JwtAuthGuard), which meant
    // there was no consistent auth enforcement. Adding it here means:
    //   - Protected routes: enforced automatically, no @UseGuards needed
    //   - Public routes:   add @Public() and the guard skips them
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}