import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface PaginationOptions {
    page?: number;
    limit?: number;
}

export interface UpdateStatusDto {
    status: OrderStatus;
}

// ---------------------------------------------------------------------------
// Valid order status transitions (state machine)
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
};

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface AdminStatsResponse {
    totalRevenue: number;
    totalOrders: number;
    totalProducts: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(private prisma: PrismaService) { }

    // -----------------------------------------------------------------------
    // CHECKOUT
    // -----------------------------------------------------------------------

    async checkout(userId: string, idempotencyKey?: string) {
        this.logger.log(`Checkout started — userId: ${userId}`);

        // --- Idempotency: return existing order if key was already processed ---
        if (idempotencyKey) {
            const existing = await this.prisma.order.findUnique({
                where: { idempotencyKey },
                include: { items: true },
            });
            if (existing) {
                this.logger.log(
                    `Idempotent checkout — returning existing order ${existing.id}`,
                );
                return existing;
            }
        }

        // --- Fetch cart with current product data ---
        const cart = await this.prisma.cart.findUnique({
            where: { userId },
            include: { items: { include: { product: true } } },
        });

        if (!cart || cart.items.length === 0) {
            throw new BadRequestException({
                code: 'CART_EMPTY',
                message: 'Your cart is empty',
            });
        }

        // --- Run everything atomically ---
        const order = await this.prisma.$transaction(async (tx) => {
            let total = 0;
            const snapshots: { productId: string; quantity: number; price: number; name: string }[] = [];

            // A. Atomic stock check + decrement in one DB operation per item.
            //    The `where: { stock: { gte: quantity } }` clause means the update
            //    only succeeds if stock is sufficient — no TOCTOU race condition.
            for (const item of cart.items) {
                let updated;
                try {
                    updated = await tx.product.update({
                        where: {
                            id: item.productId,
                            stock: { gte: item.quantity }, // atomic guard
                        },
                        data: { stock: { decrement: item.quantity } },
                        select: { id: true, name: true, price: true, stock: true },
                    });
                } catch {
                    // Prisma throws P2025 (record not found) when the where clause
                    // doesn't match — i.e. stock was insufficient.
                    const product = await tx.product.findUnique({
                        where: { id: item.productId },
                        select: { name: true, stock: true },
                    });
                    throw new BadRequestException({
                        code: 'OUT_OF_STOCK',
                        product: product?.name ?? item.productId,
                        available: product?.stock ?? 0,
                        requested: item.quantity,
                        message: `Not enough stock for ${product?.name}. Available: ${product?.stock}`,
                    });
                }

                // Snapshot the price at time of purchase (inside the transaction)
                snapshots.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: updated.price, // fresh price from DB, not stale cart data
                    name: updated.name,
                });

                total += updated.price * item.quantity;
            }

            // B. Create the order with snapshotted prices and accurate total
            const newOrder = await tx.order.create({
                data: {
                    userId,
                    total,
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                    items: {
                        create: snapshots.map(({ productId, quantity, price }) => ({
                            productId,
                            quantity,
                            price,
                        })),
                    },
                },
                include: { items: true },
            });

            // C. Clear the cart (same transaction — no ghost carts on crash)
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

            this.logger.log(
                `Order ${newOrder.id} created for user ${userId} — total: ${total}`,
            );

            return newOrder;
        });

        return order;
    }

    // -----------------------------------------------------------------------
    // GET MY ORDERS (paginated)
    // -----------------------------------------------------------------------

    async getMyOrders(userId: string, { page = 1, limit = 10 }: PaginationOptions = {}) {
        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where: { userId },
                include: { items: { include: { product: { select: { id: true, name: true, images: true } } } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.order.count({ where: { userId } }),
        ]);

        return {
            data: orders,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // -----------------------------------------------------------------------
    // GET ALL ORDERS — Admin (paginated)
    // -----------------------------------------------------------------------

    async getAllOrders({ page = 1, limit = 20 }: PaginationOptions = {}) {
        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, name: true, price: true } },
                        },
                    },
                    // Explicit select — safe even if sensitive fields are added to User later
                    user: { select: { id: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.order.count(),
        ]);

        return {
            data: orders,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // -----------------------------------------------------------------------
    // UPDATE STATUS — Admin, with state machine validation
    // -----------------------------------------------------------------------

    async updateStatus(orderId: string, status: OrderStatus) {
        // Use NotFoundException (404) — not BadRequestException (400) — for missing resource
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new NotFoundException({
                code: 'ORDER_NOT_FOUND',
                message: `Order ${orderId} not found`,
            });
        }

        // Enforce state machine — prevent illegal transitions
        const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? [];
        if (!allowed.includes(status)) {
            throw new BadRequestException({
                code: 'INVALID_STATUS_TRANSITION',
                message: `Cannot transition order from ${order.status} to ${status}`,
                allowedTransitions: allowed,
            });
        }

        this.logger.log(
            `Order ${orderId} status: ${order.status} → ${status}`,
        );

        return this.prisma.order.update({
            where: { id: orderId },
            data: { status }, // No cast needed — status is properly typed as OrderStatus
        });
    }

    // -----------------------------------------------------------------------
    // ADMIN STATS
    // -----------------------------------------------------------------------

    async getAdminStats(): Promise<AdminStatsResponse> {
        // Run all three queries in parallel — no reason to wait sequentially
        const [revenueResult, orderCount, productCount] = await Promise.all([
            this.prisma.order.aggregate({
                _sum: { total: true },
                where: { status: { not: OrderStatus.CANCELLED } },
            }),
            this.prisma.order.count(),
            this.prisma.product.count(),
        ]);

        return {
            totalRevenue: revenueResult._sum.total ?? 0,
            totalOrders: orderCount,
            totalProducts: productCount,
        };
    }
}