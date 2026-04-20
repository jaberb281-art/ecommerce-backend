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
        status: dto.status,
      },
      include: { category: true },
    });
  }

  // -----------------------------------------------------------------------
  // FIND ALL — paginated, filterable by category, searchable by name
  // Only returns ACTIVE products for storefront
  // Admin can pass status param to see all
  // -----------------------------------------------------------------------

  async findAll(paginationDto: PaginationDto & { status?: string; adminMode?: boolean }) {
    const rawPage: any = (paginationDto as any).page ?? 1;
    const rawLimit: any = (paginationDto as any).limit ?? 10;
    const page = Math.max(1, Number(rawPage) || 1);
    const limit = Math.min(50, Math.max(1, Number(rawLimit) || 10));

    const { categoryId, search, adminMode, status } = paginationDto;
    const skip = (page - 1) * limit;

    // Clear precedence: admin may pass any status; public callers only ever see ACTIVE.
    // adminMode is NEVER accepted from query params — it's set internally by the controller.
    const statusFilter: Prisma.ProductWhereInput = adminMode
      ? (status ? { status: status as any } : {})
      : { status: 'ACTIVE' };

    const where: Prisma.ProductWhereInput = {
      ...statusFilter,
      ...(categoryId && { categoryId }),
      ...(search && {
        name: {
          contains: search,
          mode: 'insensitive',
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
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.images !== undefined && { images: dto.images }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.status !== undefined && { status: dto.status as any }),
      },
      include: { category: true },
    });
  }

  // -----------------------------------------------------------------------
  // REMOVE
  // -----------------------------------------------------------------------

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.delete({
      where: { id },
    });
  }

  // -----------------------------------------------------------------------
  // BEST SELLERS — ranked by total units sold from completed orders
  // -----------------------------------------------------------------------

  async getBestSellers(limit = 10) {
    const result = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const productIds = result.map(r => r.productId)

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: 'ACTIVE', // only active products in best sellers
      },
      include: { category: true },
    })

    return productIds.map(id => {
      const product = products.find(p => p.id === id)
      const sales = result.find(r => r.productId === id)
      return {
        ...product,
        unitsSold: sales?._sum?.quantity ?? 0,
      }
    }).filter(p => p.id) // filter out products that are no longer active
  }

  // -----------------------------------------------------------------------
  // PRIVATE HELPER — pagination response envelope
  // -----------------------------------------------------------------------

  private formatPaginatedResponse(
    data: Product[],
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