import { Controller, Post, Get, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddToCartDto } from './dto/add-to-cart.dto'; // 👈 1. Import the DTO

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) { }

    @Post('add')
    async addItem(
        @Request() req,
        @Body() addToCartDto: AddToCartDto // 👈 2. Change 'body' to 'addToCartDto'
    ) {
        // 3. Use the DTO properties here
        return this.cartService.addToCart(
            req.user.id,
            addToCartDto.productId,
            addToCartDto.quantity
        );
    }

    @Get()
    async getCart(@Request() req) {
        return this.cartService.getCart(req.user.id);
    }

    @Delete('remove/:productId')
    async removeItem(@Request() req, @Param('productId') productId: string) {
        return this.cartService.removeFromCart(req.user.id, productId);
    }

    @Delete('clear')
    async clear(@Request() req) {
        return this.cartService.clearCart(req.user.id);
    }
}