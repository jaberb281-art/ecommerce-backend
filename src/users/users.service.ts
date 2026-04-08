import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetUsersDto } from './dto/get-users.dto';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll(dto: GetUsersDto) {
        const page = Number(dto.page) || 1;
        const limit = Number(dto.limit) || 10;
        const skip = Math.max((page - 1) * limit, 0);

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
                    pointsBalance: true,
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