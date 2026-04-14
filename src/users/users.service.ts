import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetUsersDto } from './dto/get-users.dto';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll(dto: GetUsersDto) {
        const page = Number(dto.page) || 1;
        const limit = Number(dto.limit) || 10;
        const skip = Math.max((page - 1) * limit, 0);

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
                    profileBg: true,
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

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                createdAt: true,
                pointsBalance: true,
                profileBg: true,
                _count: { select: { orders: true } },
                userBadges: { include: { badge: true } },
            },
        });

        if (!user) throw new NotFoundException('User not found');

        return { ...user, orderCount: user._count.orders, _count: undefined };
    }

    async update(id: string, data: { name?: string; profileBg?: string; role?: string }) {
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.profileBg !== undefined && { profileBg: data.profileBg }),
                ...(data.role !== undefined && { role: data.role as any }),
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                profileBg: true,
                pointsBalance: true,
            },
        });
        return user;
    }
}