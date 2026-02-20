import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Ensure path is correct
import { AuthModule } from '../auth/auth.module'; // 1. Add this import

@Module({
  imports: [
    PrismaModule,
    AuthModule
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule { }