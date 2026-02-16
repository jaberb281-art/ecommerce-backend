import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
    constructor(private prisma: PrismaService) { }

    async getOrCreateCart(userId: string) {
        let cart = await this.prisma.cart.findUnique({
            where: { userId },
            include: { items: true },
        });

        if (!cart) {
            cart = await this.prisma.cart.create({
                data: { userId },
                include: { items: true },
            });
        }

        return cart;
    }

    async addToCart(userId: string, productId: string, quantity: number) {
        const cart = await this.getOrCreateCart(userId);

        const existingItem = await this.prisma.cartItem.findFirst({
            where: {
                cartId: cart.id,
                productId,
            },
        });

        if (existingItem) {
            return this.prisma.cartItem.update({
                where: { id: existingItem.id },
                data: { quantity: existingItem.quantity + quantity },
            });
        }

        return this.prisma.cartItem.create({
            data: {
                cartId: cart.id,
                productId,
                quantity,
            },
        });
    }

    async getCart(userId: string) {
        return this.prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
            },
        });
    }
}
