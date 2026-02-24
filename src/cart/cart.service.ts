import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
    constructor(private prisma: PrismaService) { }

    // -----------------------------------------------------------------------
    // GET OR CREATE CART
    // Uses upsert to prevent race condition where two simultaneous requests
    // both find no cart and both attempt to create one, causing a unique
    // constraint crash on userId
    // -----------------------------------------------------------------------

    async getOrCreateCart(userId: string) {
        return this.prisma.cart.upsert({
            where: { userId },
            create: { userId },
            update: {},
            include: { items: true },
        });
    }

    // -----------------------------------------------------------------------
    // ADD TO CART
    // Fully atomic — wrapped in $transaction so the stock check, cart
    // creation, and item upsert all succeed or all fail together.
    // -----------------------------------------------------------------------

    async addToCart(userId: string, productId: string, quantity: number) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Verify product exists and re-read stock inside the transaction
            const product = await tx.product.findUnique({
                where: { id: productId },
                select: { id: true, name: true, stock: true },
            });

            if (!product) {
                throw new NotFoundException({
                    code: 'PRODUCT_NOT_FOUND',
                    message: `Product ${productId} not found`,
                });
            }

            // 2. Get or create the cart atomically inside the transaction
            const cart = await tx.cart.upsert({
                where: { userId },
                create: { userId },
                update: {},
            });

            // 3. Check current quantity already in cart using @@unique index
            const existingItem = await tx.cartItem.findUnique({
                where: {
                    cartId_productId: { cartId: cart.id, productId },
                },
            });

            const currentQuantity = existingItem?.quantity ?? 0;
            const newQuantity = currentQuantity + quantity;

            // 4. Validate against live stock inside transaction — no TOCTOU risk
            if (newQuantity > product.stock) {
                throw new BadRequestException({
                    code: 'INSUFFICIENT_STOCK',
                    message: `Cannot add ${quantity} unit(s) of "${product.name}". Available stock: ${product.stock}, already in cart: ${currentQuantity}`,
                });
            }

            // 5. Upsert the cart item — atomic create or update in one operation
            return tx.cartItem.upsert({
                where: {
                    cartId_productId: { cartId: cart.id, productId },
                },
                create: {
                    cartId: cart.id,
                    productId,
                    quantity,
                },
                update: {
                    quantity: newQuantity,
                },
                include: {
                    product: { select: { id: true, name: true, price: true } },
                },
            });
        });
    }

    // -----------------------------------------------------------------------
    // GET CART
    // -----------------------------------------------------------------------

    async getCart(userId: string) {
        const cart = await this.prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                stock: true,
                                images: true,
                            },
                        },
                    },
                },
            },
        });

        if (!cart) return { items: [], total: 0 };

        // Total uses live prices — correct for cart display.
        // Note: checkout snapshots prices at time of purchase separately.
        const total = cart.items.reduce((acc, item) => {
            return acc + item.product.price * item.quantity;
        }, 0);

        return { ...cart, total };
    }

    // -----------------------------------------------------------------------
    // REMOVE ITEM FROM CART
    // -----------------------------------------------------------------------

    async removeFromCart(userId: string, productId: string) {
        const cart = await this.prisma.cart.findUnique({ where: { userId } });

        if (!cart) {
            throw new NotFoundException({
                code: 'CART_NOT_FOUND',
                message: 'Cart not found',
            });
        }

        // Use the @@unique index for a direct lookup — no findFirst needed
        const item = await this.prisma.cartItem.findUnique({
            where: {
                cartId_productId: { cartId: cart.id, productId },
            },
        });

        if (!item) {
            throw new NotFoundException({
                code: 'CART_ITEM_NOT_FOUND',
                message: 'Item not found in cart',
            });
        }

        return this.prisma.cartItem.delete({
            where: { id: item.id },
        });
    }

    // -----------------------------------------------------------------------
    // CLEAR CART
    // -----------------------------------------------------------------------

    async clearCart(userId: string) {
        const cart = await this.prisma.cart.findUnique({ where: { userId } });

        if (!cart) {
            throw new NotFoundException({
                code: 'CART_NOT_FOUND',
                message: 'Cart not found',
            });
        }

        return this.prisma.cartItem.deleteMany({
            where: { cartId: cart.id },
        });
    }
}