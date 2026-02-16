import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
    constructor(private cartService: CartService) { }

    @Post('add')
    addToCart(
        @Query('userId') userId: string,
        @Query('productId') productId: string,
        @Query('quantity') quantity: number,
    ) {
        return this.cartService.addToCart(userId, productId, Number(quantity));
    }

    @Get()
    getCart(@Query('userId') userId: string) {
        return this.cartService.getCart(userId);
    }
}
