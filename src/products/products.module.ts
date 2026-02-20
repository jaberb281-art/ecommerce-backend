import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CloudinaryService } from '../common/cloudinary.service';
import { CloudinaryProvider } from '../common/cloudinary.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    CloudinaryService,
    CloudinaryProvider
  ],
  exports: [ProductsService],
})
export class ProductsModule { }