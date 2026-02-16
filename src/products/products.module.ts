import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Import the PrismaModule

@Module({
  imports: [PrismaModule], // Add this line here!
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule { }