import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Period = 'daily' | 'weekly' | 'monthly';

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService) { }

    async getRevenueOverTime(period: Period = 'monthly') {
        const orders = await this.prisma.order.findMany({
            where: { status: { not: 'CANCELLED' } },
            select: { total: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        })
        return this.groupByPeriod(orders, period, 'total')
    }

    async getOrdersOverTime(period: Period = 'monthly') {
        const orders = await this.prisma.order.findMany({
            where: { status: { not: 'CANCELLED' } },
            select: { id: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        })
        return this.groupByPeriod(orders.map(o => ({ ...o, count: 1 })), period, 'count')
    }

    async getTopProducts(limit = 10) {
        const result = await this.prisma.orderItem.groupBy({
            by: ['productId'],
            where: { order: { status: { not: 'CANCELLED' } } },
            _sum: { quantity: true, price: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: limit,
        })

        const productIds = result.map(r => r.productId)
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, images: true },
        })

        return productIds.map(id => {
            const product = products.find(p => p.id === id)
            const stats = result.find(r => r.productId === id)
            return {
                id,
                name: product?.name ?? 'Unknown',
                image: product?.images?.[0] ?? null,
                unitsSold: stats?._sum?.quantity ?? 0,
                revenue: stats?._sum?.price ?? 0,
            }
        })
    }

    // -----------------------------------------------------------------------
    // TOP CUSTOMERS — ranked by total spending
    // -----------------------------------------------------------------------
    async getTopCustomers(limit = 5) {
        const result = await this.prisma.order.groupBy({
            by: ['userId'],
            where: { status: { not: 'CANCELLED' } },
            _sum: { total: true },
            _count: { id: true },
            orderBy: { _sum: { total: 'desc' } },
            take: limit,
        })

        const userIds = result.map(r => r.userId)
        const users = await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
        })

        return userIds.map(id => {
            const user = users.find(u => u.id === id)
            const stats = result.find(r => r.userId === id)
            return {
                id,
                name: user?.name ?? 'Unknown',
                email: user?.email ?? '',
                totalSpent: stats?._sum?.total ?? 0,
                totalOrders: stats?._count?.id ?? 0,
            }
        })
    }

    // -----------------------------------------------------------------------
    // NEW CUSTOMERS — grouped by period
    // -----------------------------------------------------------------------
    async getNewCustomers(period: Period = 'monthly') {
        const users = await this.prisma.user.findMany({
            where: { role: 'USER' },
            select: { id: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        })

        return this.groupByPeriod(
            users.map(u => ({ ...u, count: 1 })),
            period,
            'count'
        )
    }

    // -----------------------------------------------------------------------
    // PRIVATE HELPERS
    // -----------------------------------------------------------------------

    private groupByPeriod(
        items: Array<{ createdAt: Date;[key: string]: any }>,
        period: Period,
        valueKey: string,
    ) {
        const groups: Record<string, number> = {}

        for (const item of items) {
            const date = new Date(item.createdAt)
            let key: string

            if (period === 'daily') {
                key = date.toISOString().split('T')[0]
            } else if (period === 'weekly') {
                const week = this.getWeekNumber(date)
                key = `${date.getFullYear()}-W${week}`
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            }

            groups[key] = (groups[key] ?? 0) + (item[valueKey] ?? 0)
        }

        return Object.entries(groups).map(([label, value]) => ({ label, value }))
    }

    private getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
        const dayNum = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum)
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    }
}