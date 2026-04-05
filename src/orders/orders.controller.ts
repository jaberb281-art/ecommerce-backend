import {
    Controller,
    Post,
    Get,
    Patch,
    Param,
    Body,
    Query,
    Headers,
    UseGuards,
    Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, OrderStatus } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiOkResponse, ApiQuery, ApiHeader, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderResponseDto } from './dto/order-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AdminStatsResponse } from './orders.types';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum ShippingMethod {
    EXPRESS = 'express',
    STANDARD = 'standard',
    PICKUP = 'pickup',
}

export enum PaymentMethod {
    CREDIT = 'credit',
    APPLEPAY = 'applepay',
    CASH = 'cash',
}

export class CheckoutDto {
    @ApiPropertyOptional({ enum: ShippingMethod, example: 'standard' })
    @IsOptional()
    @IsEnum(ShippingMethod)
    shippingMethod?: ShippingMethod;

    @ApiPropertyOptional({ enum: PaymentMethod, example: 'cash' })
    @IsOptional()
    @IsEnum(PaymentMethod)
    paymentMethod?: PaymentMethod;

    @ApiPropertyOptional({ example: 'coupon-uuid' })
    @IsOptional()
    @IsString()
    couponId?: string;

    @ApiPropertyOptional({ example: 'SAVE10' })
    @IsOptional()
    @IsString()
    couponCode?: string;

    @ApiPropertyOptional({ example: 'address-uuid' })
    @IsOptional()
    @IsString()
    addressId?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    isGift?: boolean;

    @ApiPropertyOptional({ example: 'Happy Birthday!' })
    @IsOptional()
    @IsString()
    giftMessage?: string;

    @ApiPropertyOptional({ example: 'John' })
    @IsOptional()
    @IsString()
    giftSenderName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    giftRecipientAddress?: any;
}

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    // -------------------------------------------------------------------------
    // POST /orders/checkout
    // -------------------------------------------------------------------------
    @Post('checkout')
    @ApiOkResponse({ type: OrderResponseDto })
    @ApiHeader({
        name: 'x-idempotency-key',
        description: 'Optional unique key to prevent duplicate orders on retry',
        required: false,
    })
    async checkout(
        @Request() req,
        @Headers('x-idempotency-key') idempotencyKey?: string,
        @Body() dto: CheckoutDto = {},
    ) {
        return this.ordersService.checkout(req.user.id, idempotencyKey, {
            couponId: dto.couponId,
            couponCode: dto.couponCode,
            shippingMethod: dto.shippingMethod,
            paymentMethod: dto.paymentMethod,
            addressId: dto.addressId,
            isGift: dto.isGift,
            giftMessage: dto.giftMessage,
            giftSenderName: dto.giftSenderName ?? dto.giftRecipientAddress?.senderName,
            giftRecipientName: dto.giftRecipientAddress?.fullName,
            giftRecipientPhone: dto.giftRecipientAddress?.phone,
            giftRecipientAddress: dto.giftRecipientAddress
                ? `${dto.giftRecipientAddress.building ?? ''}, ${dto.giftRecipientAddress.street ?? ''}, Block ${dto.giftRecipientAddress.block ?? ''}, ${dto.giftRecipientAddress.city ?? ''}, ${dto.giftRecipientAddress.country ?? ''}`.replace(/,\s*,/g, ',').trim()
                : undefined,
        });
    }

    // -------------------------------------------------------------------------
    // GET /orders?page=1&limit=10
    // -------------------------------------------------------------------------
    @Get()
    @ApiOkResponse({ type: [OrderResponseDto] })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getMyOrders(
        @Request() req,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.ordersService.getMyOrders(req.user.id, {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 10,
        });
    }

    // -------------------------------------------------------------------------
    // GET /orders/admin/all?page=1&limit=20  — Admin only
    // -------------------------------------------------------------------------
    @Get('admin/all')
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    @ApiOkResponse({ type: [OrderResponseDto] })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getAllOrders(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.ordersService.getAllOrders({
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
        });
    }

    // -------------------------------------------------------------------------
    // GET /orders/admin/stats  — Admin only
    // -------------------------------------------------------------------------
    @Get('admin/stats')
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    async getStats(): Promise<AdminStatsResponse> {
        return this.ordersService.getAdminStats();
    }

    // -------------------------------------------------------------------------
    // GET /orders/:id
    // -------------------------------------------------------------------------
    @Get(':id')
    @ApiOkResponse({ type: OrderResponseDto })
    async getMyOrder(
        @Request() req,
        @Param('id') id: string,
    ) {
        return this.ordersService.getMyOrder(req.user.id, id);
    }

    // -------------------------------------------------------------------------
    // PATCH /orders/:id/status  — Admin only
    // -------------------------------------------------------------------------
    @Patch(':id/status')
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    @ApiOkResponse({ type: OrderResponseDto })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateStatus(id, dto.status as OrderStatus);
    }
}