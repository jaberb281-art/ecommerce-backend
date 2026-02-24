import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Ensure this path is correct

@Module({
  imports: [PrismaModule], // This must be here!
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoryModule { }