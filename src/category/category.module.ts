import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Ensure this path is correct

@Module({
  imports: [PrismaModule], // This must be here!
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule { }