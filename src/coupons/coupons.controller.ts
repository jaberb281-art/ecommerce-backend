import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
    constructor(private couponsService: CouponsService) { }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all coupons (Admin only)' })
    findAll() {
        return this.couponsService.findAll()
    }

    @Get('validate')
    @ApiOperation({ summary: 'Validate a coupon code' })
    validate(@Query('code') code: string, @Query('total') total: string) {
        return this.couponsService.validate(code, parseFloat(total))
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a coupon (Admin only)' })
    create(@Body() dto: CreateCouponDto) {
        return this.couponsService.create(dto)
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a coupon (Admin only)' })
    update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
        return this.couponsService.update(id, dto)
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a coupon (Admin only)' })
    remove(@Param('id') id: string) {
        return this.couponsService.remove(id)
    }
}