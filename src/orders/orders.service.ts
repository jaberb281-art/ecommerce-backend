import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';

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

export interface CheckoutOptions {
    couponId?: string;
    couponCode?: string;
    shippingMethod?: string;
    paymentMethod?: string;
    addressId?: string;
    isGift?: boolean;
    giftMessage?: string;
    giftSenderName?: string;
    giftRecipientName?: string;
    giftRecipientPhone?: string;
    giftRecipientAddress?: string;
}

// ---------------------------------------------------------------------------
// Valid order status transitions (state machine)
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
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
    totalUsers: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        private prisma: PrismaService,
        private couponsService: CouponsService,
    ) { }

    // -----------------------------------------------------------------------
    // CHECKOUT
    // -----------------------------------------------------------------------

    async checkout(userId: string, idempotencyKey?: string, options: CheckoutOptions = {}) {
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

        // --- Validate address belongs to this user ---
        if (options.addressId) {
            const address = await this.prisma.address.findUnique({
                where: { id: options.addressId },
            });
            if (!address || address.userId !== userId) {
                throw new BadRequestException({
                    code: 'INVALID_ADDRESS',
                    message: 'Invalid delivery address',
                });
            }
        }

        // --- Validate coupon BEFORE the transaction (throws if invalid) ---
        let couponDiscount = 0;
        let validatedCouponId: string | undefined;

        // Support lookup by couponId or couponCode
        const couponLookup = options.couponId
            ? { id: options.couponId }
            : options.couponCode
                ? { code: options.couponCode }
                : null;

        if (couponLookup) {
            const coupon = await this.prisma.coupon.findUnique({
                where: couponLookup as any,
            });

            if (!coupon || !coupon.isActive) {
                throw new BadRequestException({
                    code: 'INVALID_COUPON',
                    message: 'Invalid or inactive coupon',
                });
            }

            if (coupon.expiresAt && new Date() > coupon.expiresAt) {
                throw new BadRequestException({
                    code: 'COUPON_EXPIRED',
                    message: 'Coupon has expired',
                });
            }

            if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
                throw new BadRequestException({
                    code: 'COUPON_EXHAUSTED',
                    message: 'Coupon usage limit reached',
                });
            }

            // Calculate subtotal to check minOrderValue
            const subtotal = cart.items.reduce(
                (sum, item) => sum + item.product.price * item.quantity,
                0,
            );

            if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
                throw new BadRequestException({
                    code: 'ORDER_TOO_SMALL',
                    message: `Minimum order value is $${coupon.minOrderValue}`,
                });
            }

            // Calculate discount amount
            couponDiscount =
                coupon.discountType === 'PERCENTAGE'
                    ? (subtotal * coupon.discountValue) / 100
                    : coupon.discountValue;

            couponDiscount = Math.min(couponDiscount, subtotal);
            validatedCouponId = coupon.id;
        }

        // --- Run everything atomically ---
        const order = await this.prisma.$transaction(async (tx) => {
            let total = 0;
            const snapshots: { productId: string; quantity: number; price: number; name: string }[] = [];

            // A. Atomic stock check + decrement per item
            for (const item of cart.items) {
                let updated;
                try {
                    updated = await tx.product.update({
                        where: {
                            id: item.productId,
                            stock: { gte: item.quantity },
                        },
                        data: { stock: { decrement: item.quantity } },
                        select: { id: true, name: true, price: true, stock: true },
                    });
                } catch {
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

                snapshots.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: updated.price,
                    name: updated.name,
                });

                total += updated.price * item.quantity;
            }

            // B. Apply coupon discount to total
            const discountedTotal = Math.max(total - couponDiscount, 0);

            // C. Create the order with discounted total and coupon reference
            const newOrder = await tx.order.create({
                data: {
                    userId,
                    total: discountedTotal,
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                    ...(validatedCouponId ? { couponId: validatedCouponId } : {}),
                    ...(options.addressId ? { addressId: options.addressId } : {}),
                    isGift: options.isGift ?? false,
                    ...(options.giftMessage ? { giftMessage: options.giftMessage } : {}),
                    ...(options.giftSenderName ? { giftSenderName: options.giftSenderName } : {}),
                    ...(options.giftRecipientName ? { giftRecipientName: options.giftRecipientName } : {}),
                    ...(options.giftRecipientPhone ? { giftRecipientPhone: options.giftRecipientPhone } : {}),
                    ...(options.giftRecipientAddress ? { giftRecipientAddress: options.giftRecipientAddress } : {}),
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

            // D. Increment coupon usedCount inside the same transaction
            if (validatedCouponId) {
                await tx.coupon.update({
                    where: { id: validatedCouponId },
                    data: { usedCount: { increment: 1 } },
                });
                this.logger.log(`Coupon ${validatedCouponId} usedCount incremented`);
            }

            // E. Clear the cart
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

            this.logger.log(
                `Order ${newOrder.id} created for user ${userId} — total: ${discountedTotal} (discount: ${couponDiscount}) — shipping: ${options.shippingMethod ?? 'standard'} — payment: ${options.paymentMethod ?? 'cash'}`,
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
    // GET SINGLE ORDER — for current user
    // -----------------------------------------------------------------------

    async getMyOrder(userId: string, orderId: string) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, userId },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, images: true, price: true }
                        }
                    }
                }
            },
        });

        if (!order) {
            throw new NotFoundException({
                code: 'ORDER_NOT_FOUND',
                message: `Order ${orderId} not found`,
            });
        }

        return order;
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
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    price: true,
                                    images: true,
                                    category: { select: { name: true } },
                                },
                            },
                        },
                    },
                    user: { select: { id: true, name: true, email: true } },
                    coupon: { select: { id: true, code: true, discountType: true, discountValue: true } },
                    address: true,
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
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new NotFoundException({
                code: 'ORDER_NOT_FOUND',
                message: `Order ${orderId} not found`,
            });
        }

        const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? [];
        if (!allowed.includes(status)) {
            throw new BadRequestException({
                code: 'INVALID_STATUS_TRANSITION',
                message: `Cannot transition order from ${order.status} to ${status}`,
                allowedTransitions: allowed,
            });
        }

        this.logger.log(`Order ${orderId} status: ${order.status} → ${status}`);

        return this.prisma.order.update({
            where: { id: orderId },
            data: { status },
        });
    }

    // -----------------------------------------------------------------------
    // ADMIN STATS
    // -----------------------------------------------------------------------

    async getAdminStats(): Promise<AdminStatsResponse> {
        const [revenueResult, orderCount, productCount, userCount] = await Promise.all([
            this.prisma.order.aggregate({
                _sum: { total: true },
                where: { status: { not: OrderStatus.CANCELLED } },
            }),
            this.prisma.order.count(),
            this.prisma.product.count(),
            this.prisma.user.count(),
        ]);

        return {
            totalRevenue: revenueResult._sum.total ?? 0,
            totalOrders: orderCount,
            totalProducts: productCount,
            totalUsers: userCount,
        };
    }
}