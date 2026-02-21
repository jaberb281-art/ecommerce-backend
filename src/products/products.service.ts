import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto'; // 👈 Import this

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) { }

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        stock: dto.stock,
        images: dto.images,
        categoryId: dto.categoryId,
      },
      include: { category: true },
    });
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10, categoryId } = paginationDto; // 👈 1. Get categoryId from DTO
    const skip = (page - 1) * limit;

    // 👈 2. Create the filter object
    const where = categoryId ? { categoryId } : {};

    const [totalItems, products] = await Promise.all([
      this.prisma.product.count({ where }), // 👈 3. Count only filtered items
      this.prisma.product.findMany({
        where, // 👈 4. Filter the results
        skip,
        take: limit,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return this.formatPaginatedResponse(products, totalItems, page, limit);
  }

  async findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }

  // 🛡️ PRIVATE HELPER: Keeps the pagination math out of your main logic
  private formatPaginatedResponse(data: any[], totalItems: number, page: number, limit: number) {
    const totalPages = Math.ceil(totalItems / limit);
    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}