import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    UseGuards,
    Request,
    Param,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AddToCartDto } from './dto/add-to-cart.dto';

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
        return this.cartService.getCart(req.user.id); // ✅ id not sub
    }

    // -----------------------------------------------------------------------
    // POST /cart/add
    // -----------------------------------------------------------------------
    @Post('add')
    @ApiOperation({ summary: 'Add item to cart' })
    async addItem(@Request() req, @Body() addToCartDto: AddToCartDto) {
        return this.cartService.addToCart(
            req.user.id, // ✅ id not sub
            addToCartDto.productId,
            addToCartDto.quantity,
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
        return this.cartService.clearCart(req.user.id); // ✅ id not sub
    }

    // -----------------------------------------------------------------------
    // DELETE /cart/remove/:productId
    // -----------------------------------------------------------------------
    @Delete('remove/:productId')
    @ApiOperation({ summary: 'Remove a specific item from cart' })
    async removeItem(@Request() req, @Param('productId') productId: string) {
        return this.cartService.removeFromCart(req.user.id, productId); // ✅ id not sub
    }
}