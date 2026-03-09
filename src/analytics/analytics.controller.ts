import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';


@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
@SkipThrottle()
export class AnalyticsController {
    constructor(private analyticsService: AnalyticsService) { }

    @Get('revenue')
    @ApiOperation({ summary: 'Get revenue over time' })
    getRevenue(@Query('period') period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
        return this.analyticsService.getRevenueOverTime(period)
    }

    @Get('orders')
    @ApiOperation({ summary: 'Get orders over time' })
    getOrders(@Query('period') period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
        return this.analyticsService.getOrdersOverTime(period)
    }

    @Get('top-products')
    @ApiOperation({ summary: 'Get top selling products' })
    getTopProducts(@Query('limit') limit?: string) {
        return this.analyticsService.getTopProducts(limit ? parseInt(limit) : 10)
    }
    @Get('top-customers')
    @ApiOperation({ summary: 'Get top customers by spending' })
    getTopCustomers(@Query('limit') limit?: string) {
        return this.analyticsService.getTopCustomers(limit ? parseInt(limit) : 5)
    }

    @Get('new-customers')
    @ApiOperation({ summary: 'Get new customers over time' })
    getNewCustomers(@Query('period') period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
        return this.analyticsService.getNewCustomers(period)
    }
}