import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { CategoryModule } from './category/category.module';
import { CartModule } from './cart/cart.module';

@Module({
  imports: [AuthModule, PrismaModule, ProductsModule, CategoryModule, CartModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
