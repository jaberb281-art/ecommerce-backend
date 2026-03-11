import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AddressesService, CreateAddressDto } from './addresses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
    constructor(private addressesService: AddressesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all addresses for current user' })
    findAll(@Request() req) {
        return this.addressesService.findAll(req.user.id);
    }

    @Post()
    @ApiOperation({ summary: 'Add a new address' })
    create(@Request() req, @Body() dto: CreateAddressDto) {
        return this.addressesService.create(req.user.id, dto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an address' })
    update(@Request() req, @Param('id') id: string, @Body() dto: Partial<CreateAddressDto>) {
        return this.addressesService.update(req.user.id, id, dto);
    }

    @Patch(':id/default')
    @ApiOperation({ summary: 'Set address as default' })
    setDefault(@Request() req, @Param('id') id: string) {
        return this.addressesService.setDefault(req.user.id, id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete an address' })
    remove(@Request() req, @Param('id') id: string) {
        return this.addressesService.remove(req.user.id, id);
    }
}