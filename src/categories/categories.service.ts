import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateCategoryDto) {
        return this.prisma.category.create({ data: dto });
    }

    async findAll() {
        return this.prisma.category.findMany({
            include: { products: true }, // Show products inside each category
        });
    }
}