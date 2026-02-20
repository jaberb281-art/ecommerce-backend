import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module'; // 👈 Add this line!

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule { }