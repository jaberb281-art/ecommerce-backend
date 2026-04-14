import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { GetUsersDto } from './dto/get-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get()
    findAll(@Query() dto: GetUsersDto) {
        return this.usersService.findAll(dto);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() body: { name?: string; profileBg?: string; role?: string }) {
        return this.usersService.update(id, body);
    }
}