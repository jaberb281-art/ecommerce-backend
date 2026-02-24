import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private prisma: PrismaService) { }

    // -----------------------------------------------------------------------
    // CREATE
    // -----------------------------------------------------------------------

    async create(dto: CreateCategoryDto) {
        // Check for duplicate name — gives clean 409 instead of raw P2002
        const existing = await this.prisma.category.findUnique({
            where: { name: dto.name },
        });

        if (existing) {
            throw new ConflictException({
                code: 'CATEGORY_ALREADY_EXISTS',
                message: `A category named "${dto.name}" already exists`,
            });
        }

        return this.prisma.category.create({
            data: { name: dto.name }, // Explicit mapping — no mass-assignment
        });
    }

    // -----------------------------------------------------------------------
    // FIND ALL
    // Returns categories with product count only — not full product objects.
    // Use findOne to get a category with its full product list.
    // -----------------------------------------------------------------------

    async findAll() {
        const categories = await this.prisma.category.findMany({
            include: {
                _count: { select: { products: true } }, // Count only, not full list
            },
            orderBy: { name: 'asc' },
        });

        return categories.map(({ _count, ...category }) => ({
            ...category,
            productCount: _count.products,
        }));
    }

    // -----------------------------------------------------------------------
    // FIND ONE — includes full product list for this category
    // -----------------------------------------------------------------------

    async findOne(id: string) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            include: {
                products: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        stock: true,
                        images: true,
                    },
                    orderBy: { createdAt: 'desc' },
                },
                _count: { select: { products: true } },
            },
        });

        if (!category) {
            throw new NotFoundException({
                code: 'CATEGORY_NOT_FOUND',
                message: `Category ${id} not found`,
            });
        }

        const { _count, ...rest } = category;
        return { ...rest, productCount: _count.products };
    }

    // -----------------------------------------------------------------------
    // UPDATE
    // -----------------------------------------------------------------------

    async update(id: string, dto: UpdateCategoryDto) {
        await this.findOne(id); // Throws 404 if not found

        // Check new name isn't already taken by a different category
        if (dto.name) {
            const existing = await this.prisma.category.findUnique({
                where: { name: dto.name },
            });

            if (existing && existing.id !== id) {
                throw new ConflictException({
                    code: 'CATEGORY_ALREADY_EXISTS',
                    message: `A category named "${dto.name}" already exists`,
                });
            }
        }

        return this.prisma.category.update({
            where: { id },
            data: { ...(dto.name && { name: dto.name }) },
        });
    }

    // -----------------------------------------------------------------------
    // REMOVE
    // -----------------------------------------------------------------------

    async remove(id: string) {
        await this.findOne(id); // Throws 404 if not found

        // Note: schema has onDelete: Cascade on Product → Category relation,
        // so deleting a category will also delete all its products.
        // Consider adding a check here if you want to prevent that:
        //
        // const { productCount } = await this.findOne(id);
        // if (productCount > 0) {
        //     throw new BadRequestException({
        //         code: 'CATEGORY_HAS_PRODUCTS',
        //         message: `Cannot delete a category that contains ${productCount} products`,
        //     });
        // }

        return this.prisma.category.delete({ where: { id } });
    }
}