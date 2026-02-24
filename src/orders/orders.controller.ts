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
import { ApiBearerAuth, ApiTags, ApiOkResponse, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { OrderResponseDto } from './dto/order-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AdminStatsResponse } from './orders.types';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    // -------------------------------------------------------------------------
    // POST /orders/checkout
    // Optional idempotency key header prevents duplicate orders on client retry
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
    ) {
        return this.ordersService.checkout(req.user.id, idempotencyKey);
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
    // Must be defined BEFORE /orders/:id to avoid route collision
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