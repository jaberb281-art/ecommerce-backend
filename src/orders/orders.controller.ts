import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard'; // 👈 Import RolesGuard
import { Roles } from '../auth/decorators/roles.decorator'; // 👈 Import Roles Decorator
import { Role } from '@prisma/client'; // 👈 Import Role enum
import { ApiBearerAuth, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { OrderResponseDto } from './dto/order-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto'; // 👈 Import the DTO

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post('checkout')
    @ApiOkResponse({ type: OrderResponseDto })
    async checkout(@Request() req) {
        return this.ordersService.checkout(req.user.id);
    }

    @Get()
    @ApiOkResponse({ type: [OrderResponseDto] })
    async getMyOrders(@Request() req) {
        return this.ordersService.getMyOrders(req.user.id);
    }
    @Patch(':id/status')
    @Roles(Role.ADMIN) // Lock it to Admins only
    @UseGuards(RolesGuard) // Apply the Roles security guard
    @ApiOkResponse({ type: OrderResponseDto })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateStatus(id, dto.status);
    }
    @Get('admin/all')
    @Roles(Role.ADMIN) // 👈 Admin Only!
    @UseGuards(RolesGuard)
    @ApiOkResponse({ type: [OrderResponseDto] })
    async getAllOrders() {
        return this.ordersService.getAllOrders();
    }
    @Get('admin/stats')
    @Roles(Role.ADMIN)
    @UseGuards(RolesGuard)
    async getStats() {
        return this.ordersService.getAdminStats();
    }
}