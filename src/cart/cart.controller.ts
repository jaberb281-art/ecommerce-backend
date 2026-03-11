import {
    Controller,
    Post,
    Get,
    Delete,
    Patch,
    Body,
    UseGuards,
    Request,
    Param,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update.cart.item.dto';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard) // All cart routes require authentication
@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) { }

    // -----------------------------------------------------------------------
    // GET /cart
    // -----------------------------------------------------------------------
    @Get()
    @ApiOperation({ summary: 'Get current user cart with live total' })
    async getCart(@Request() req) {
        return this.cartService.getCart(req.user.id);
    }

    // -----------------------------------------------------------------------
    // POST /cart/add  — increments quantity (product page "Add to Cart")
    // -----------------------------------------------------------------------
    @Post('add')
    @ApiOperation({ summary: 'Add item to cart (increments if already exists)' })
    async addItem(@Request() req, @Body() addToCartDto: AddToCartDto) {
        return this.cartService.addToCart(
            req.user.id,
            addToCartDto.productId,
            addToCartDto.quantity,
        );
    }

    // -----------------------------------------------------------------------
    // PATCH /cart/update  — sets exact quantity (cart page +/- buttons)
    // -----------------------------------------------------------------------
    @Patch('update')
    @ApiOperation({ summary: 'Set exact quantity for a cart item' })
    async updateItem(@Request() req, @Body() updateCartItemDto: UpdateCartItemDto) {
        return this.cartService.updateCartItem(
            req.user.id,
            updateCartItemDto.productId,
            updateCartItemDto.quantity,
        );
    }

    // -----------------------------------------------------------------------
    // DELETE /cart/clear
    // IMPORTANT: Must be defined BEFORE /cart/remove/:productId to avoid
    // NestJS matching "clear" as the productId parameter
    // -----------------------------------------------------------------------
    @Delete('clear')
    @ApiOperation({ summary: 'Clear all items from cart' })
    async clear(@Request() req) {
        return this.cartService.clearCart(req.user.id);
    }

    // -----------------------------------------------------------------------
    // DELETE /cart/remove/:productId
    // -----------------------------------------------------------------------
    @Delete('remove/:productId')
    @ApiOperation({ summary: 'Remove a specific item from cart' })
    async removeItem(@Request() req, @Param('productId') productId: string) {
        return this.cartService.removeFromCart(req.user.id, productId);
    }
}