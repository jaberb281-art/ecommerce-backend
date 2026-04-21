import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Period = 'daily' | 'weekly' | 'monthly';

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService) { }

    // -----------------------------------------------------------------------
    // REVENUE OVER TIME — grouped in the DB, no full table scan in JS
    // -----------------------------------------------------------------------
    async getRevenueOverTime(period: Period = 'monthly') {
        const trunc = this.pgDateTrunc(period);
        const rows = await this.prisma.$queryRawUnsafe<{ label: string; value: number }[]>(`
            SELECT
                TO_CHAR(DATE_TRUNC('${trunc}', "createdAt"), ${this.labelFormat(period)}) AS label,
                COALESCE(SUM(total), 0)::float                                             AS value
            FROM "Order"
            WHERE status <> 'CANCELLED'
            GROUP BY DATE_TRUNC('${trunc}', "createdAt")
            ORDER BY DATE_TRUNC('${trunc}', "createdAt") ASC
        `);
        return rows.map(r => ({ label: r.label, value: Number(r.value) }));
    }

    // -----------------------------------------------------------------------
    // ORDERS OVER TIME
    // -----------------------------------------------------------------------
    async getOrdersOverTime(period: Period = 'monthly') {
        const trunc = this.pgDateTrunc(period);
        const rows = await this.prisma.$queryRawUnsafe<{ label: string; value: number }[]>(`
            SELECT
                TO_CHAR(DATE_TRUNC('${trunc}', "createdAt"), ${this.labelFormat(period)}) AS label,
                COUNT(*)::float                                                            AS value
            FROM "Order"
            WHERE status <> 'CANCELLED'
            GROUP BY DATE_TRUNC('${trunc}', "createdAt")
            ORDER BY DATE_TRUNC('${trunc}', "createdAt") ASC
        `);
        return rows.map(r => ({ label: r.label, value: Number(r.value) }));
    }

    // -----------------------------------------------------------------------
    // TOP PRODUCTS — already uses groupBy, unchanged
    // -----------------------------------------------------------------------
    async getTopProducts(limit = 10) {
        const result = await this.prisma.orderItem.groupBy({
            by: ['productId'],
            where: { order: { status: { not: 'CANCELLED' } } },
            _sum: { quantity: true, price: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: limit,
        });

        const productIds = result.map(r => r.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, images: true },
        });

        return productIds.map(id => {
            const product = products.find(p => p.id === id);
            const stats = result.find(r => r.productId === id);
            return {
                id,
                name: product?.name ?? 'Unknown',
                image: product?.images?.[0] ?? null,
                unitsSold: stats?._sum?.quantity ?? 0,
                revenue: stats?._sum?.price ?? 0,
            };
        });
    }

    // -----------------------------------------------------------------------
    // TOP CUSTOMERS — already uses groupBy, unchanged
    // -----------------------------------------------------------------------
    async getTopCustomers(limit = 5) {
        const result = await this.prisma.order.groupBy({
            by: ['userId'],
            where: { status: { not: 'CANCELLED' } },
            _sum: { total: true },
            _count: { id: true },
            orderBy: { _sum: { total: 'desc' } },
            take: limit,
        });

        const userIds = result.map(r => r.userId);
        const users = await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
        });

        return userIds.map(id => {
            const user = users.find(u => u.id === id);
            const stats = result.find(r => r.userId === id);
            return {
                id,
                name: user?.name ?? 'Unknown',
                email: user?.email ?? '',
                totalSpent: stats?._sum?.total ?? 0,
                totalOrders: stats?._count?.id ?? 0,
            };
        });
    }

    // -----------------------------------------------------------------------
    // NEW CUSTOMERS — grouped in the DB
    // -----------------------------------------------------------------------
    async getNewCustomers(period: Period = 'monthly') {
        const trunc = this.pgDateTrunc(period);
        const rows = await this.prisma.$queryRawUnsafe<{ label: string; value: number }[]>(`
            SELECT
                TO_CHAR(DATE_TRUNC('${trunc}', "createdAt"), ${this.labelFormat(period)}) AS label,
                COUNT(*)::float                                                            AS value
            FROM "User"
            WHERE role = 'USER'
            GROUP BY DATE_TRUNC('${trunc}', "createdAt")
            ORDER BY DATE_TRUNC('${trunc}', "createdAt") ASC
        `);
        return rows.map(r => ({ label: r.label, value: Number(r.value) }));
    }

    // -----------------------------------------------------------------------
    // PRIVATE HELPERS
    // -----------------------------------------------------------------------

    /** Maps our Period type to a Postgres DATE_TRUNC field */
    private pgDateTrunc(period: Period): string {
        if (period === 'daily') return 'day';
        if (period === 'weekly') return 'week';
        return 'month';
    }

    /** Returns the TO_CHAR format string for the given period */
    private labelFormat(period: Period): string {
        if (period === 'daily') return "'YYYY-MM-DD'";
        if (period === 'weekly') return "'IYYY-\"W\"IW'"; // ISO week e.g. 2024-W03
        return "'YYYY-MM'";
    }
}