import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
    constructor(private prisma: PrismaService) { }

    async checkout(userId: string) {
        // 1. Get the cart and items
        const cart = await this.prisma.cart.findUnique({
            where: { userId },
            include: { items: { include: { product: true } } },
        });

        if (!cart || cart.items.length === 0) {
            throw new BadRequestException('Your cart is empty');
        }

        // 2. Safety Check: Verify stock for all items
        for (const item of cart.items) {
            if (item.product.stock < item.quantity) {
                throw new BadRequestException(
                    `Not enough stock for ${item.product.name}. Available: ${item.product.stock}`,
                );
            }
        }

        // 3. Calculate total
        const total = cart.items.reduce((sum, item) => {
            return sum + item.product.price * item.quantity;
        }, 0);

        // 4. Run everything in a Transaction
        return this.prisma.$transaction(async (tx) => {
            // A. Create the Order
            const order = await tx.order.create({
                data: {
                    userId,
                    total,
                    items: {
                        create: cart.items.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.product.price,
                        })),
                    },
                },
                include: { items: true },
            });

            // B. Update Product Stock (Decrementing)
            for (const item of cart.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            decrement: item.quantity,
                        },
                    },
                });
            }

            // C. Clear the Cart Items
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

            return order;
        });
    }

    async getMyOrders(userId: string) {
        return this.prisma.order.findMany({
            where: { userId },
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getAllOrders() {
        return this.prisma.order.findMany({
            include: {
                items: { include: { product: true } },
                user: { select: { email: true } } // Also see who bought it!
            },
            orderBy: { createdAt: 'desc' },
        });
    } async updateStatus(orderId: string, status: string) {
        // 1. Check if order exists
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new BadRequestException(`Order with ID ${orderId} not found`);
        }

        // 2. Update the status
        return this.prisma.order.update({
            where: { id: orderId },
            data: { status: status as any }, // Cast as 'any' to match Prisma's internal enum
        });
    } async getAdminStats() {
        const totalRevenue = await this.prisma.order.aggregate({
            _sum: {
                total: true,
            },
            where: {
                status: { not: 'CANCELLED' } // Don't count lost sales
            }
        });

        const orderCount = await this.prisma.order.count();
        const productCount = await this.prisma.product.count();

        return {
            totalRevenue: totalRevenue._sum.total || 0,
            totalOrders: orderCount,
            totalProducts: productCount,
        };
    }
}