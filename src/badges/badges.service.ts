import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BadgesService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.badge.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { userBadges: true } } },
        })
    }

    async findOne(id: string) {
        const badge = await this.prisma.badge.findUnique({
            where: { id },
            include: { _count: { select: { userBadges: true } } },
        })
        if (!badge) throw new NotFoundException('Badge not found')
        return badge
    }

    async create(dto: { name: string; description?: string; imageUrl?: string; color?: string }) {
        return this.prisma.badge.create({ data: dto })
    }

    async update(id: string, dto: { name?: string; description?: string; imageUrl?: string; color?: string }) {
        await this.findOne(id)
        return this.prisma.badge.update({ where: { id }, data: dto })
    }

    async remove(id: string) {
        await this.findOne(id)
        return this.prisma.badge.delete({ where: { id } })
    }

    async awardToUser(badgeId: string, userId: string, awardedBy: string, note?: string) {
        // Check badge exists
        await this.findOne(badgeId)

        // Check user exists
        const user = await this.prisma.user.findUnique({ where: { id: userId } })
        if (!user) throw new NotFoundException('User not found')

        // Award badge
        const userBadge = await this.prisma.userBadge.upsert({
            where: { userId_badgeId: { userId, badgeId } },
            update: { awardedBy, note },
            create: { userId, badgeId, awardedBy, note },
            include: { badge: true },
        })

        // Create in-app notification
        await this.prisma.notification.create({
            data: {
                userId,
                title: 'You earned a badge! 🎉',
                message: `Congratulations! You've been awarded the "${userBadge.badge.name}" badge.${note ? ` Note: ${note}` : ''}`,
                type: 'BADGE_AWARDED',
            },
        })

        return userBadge
    }

    async revokeFromUser(badgeId: string, userId: string) {
        return this.prisma.userBadge.delete({
            where: { userId_badgeId: { userId, badgeId } },
        })
    }

    async getUserBadges(userId: string) {
        return this.prisma.userBadge.findMany({
            where: { userId },
            include: { badge: true },
            orderBy: { awardedAt: 'desc' },
        })
    }

    async getAllUsersWithBadges() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                userBadges: {
                    include: { badge: true },
                    orderBy: { awardedAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        })
    }
}