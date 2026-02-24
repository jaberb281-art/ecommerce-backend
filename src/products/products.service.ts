import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Product } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) { }

  // -----------------------------------------------------------------------
  // CREATE
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // FIND ALL — paginated, filterable by category, searchable by name
  // -----------------------------------------------------------------------

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10, categoryId, search } = paginationDto;
    const skip = (page - 1) * limit;

    // Build filter dynamically — only include clauses that have values
    const where: Prisma.ProductWhereInput = {
      ...(categoryId && { categoryId }),
      ...(search && {
        name: {
          contains: search,
          mode: 'insensitive', // Case-insensitive search
        },
      }),
    };

    const [totalItems, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return this.formatPaginatedResponse(products, totalItems, page, limit);
  }

  // -----------------------------------------------------------------------
  // FIND ONE
  // -----------------------------------------------------------------------

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    // Return clean 404 instead of null body with 200 status
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Product ${id} not found`,
      });
    }

    return product;
  }

  // -----------------------------------------------------------------------
  // UPDATE
  // -----------------------------------------------------------------------

  async update(id: string, dto: UpdateProductDto) {
    // Verify product exists first — gives a clean 404 instead of Prisma P2025
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      // Explicit field mapping — prevents accidental mass-assignment if
      // DTO shape changes (e.g. someone adds an 'id' field to UpdateProductDto)
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.images !== undefined && { images: dto.images }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: { category: true },
    });
  }

  // -----------------------------------------------------------------------
  // REMOVE
  // -----------------------------------------------------------------------

  async remove(id: string) {
    // Verify product exists first — gives a clean 404 instead of Prisma P2025
    await this.findOne(id);

    return this.prisma.product.delete({
      where: { id },
    });
  }

  // -----------------------------------------------------------------------
  // PRIVATE HELPER — pagination response envelope
  // -----------------------------------------------------------------------

  private formatPaginatedResponse(
    data: Product[],  // Typed with Prisma's generated Product type
    totalItems: number,
    page: number,
    limit: number,
  ) {
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