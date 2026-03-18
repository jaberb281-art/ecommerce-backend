import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetUsersDto } from './dto/get-users.dto';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll(dto: GetUsersDto) {
        // 1. Add strict defaults to prevent 'undefined' values
        const page = Number(dto.page) || 1;
        const limit = Number(dto.limit) || 10;

        // 2. Ensure skip is never negative
        const skip = Math.max((page - 1) * limit, 0);

        // 3. Debug log to see exactly what the backend is receiving
        console.log(`[UsersService] Fetching page ${page} with limit ${limit}`);

        const [users, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    _count: { select: { orders: true } },
                },
            }),
            this.prisma.user.count(),
        ]);

        return {
            data: users.map((u) => ({
                ...u,
                orderCount: u._count.orders,
                _count: undefined,
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}