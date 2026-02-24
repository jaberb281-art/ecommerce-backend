import { OrderStatus } from '@prisma/client';

export interface PaginationOptions {
    page?: number;
    limit?: number;
}

export interface UpdateStatusDto {
    status: OrderStatus;
}

export interface AdminStatsResponse {
    totalRevenue: number;
    totalOrders: number;
    totalProducts: number;
}