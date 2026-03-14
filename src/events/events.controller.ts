import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, Query, UseGuards
} from '@nestjs/common'
import { EventsService } from './events.service'
import { CreateEventDto, UpdateEventDto } from './event.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { EventStatus } from '@prisma/client'

@Controller('events')
export class EventsController {
    constructor(private readonly eventsService: EventsService) { }

    // ── Public routes ────────────────────────────────────────────────────────

    @Get()
    findAll(@Query('status') status?: EventStatus) {
        return this.eventsService.findAll(status)
    }

    // ── Admin routes (must be before :id) ────────────────────────────────────

    @Get('admin/all')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    findAllAdmin(@Query('status') status?: EventStatus) {
        return this.eventsService.findAllAdmin(status)
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() dto: CreateEventDto) {
        return this.eventsService.create(dto)
    }

    @Patch(':id/toggle-publish')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    togglePublish(@Param('id') id: string) {
        return this.eventsService.togglePublish(id)
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
        return this.eventsService.update(id, dto)
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('id') id: string) {
        return this.eventsService.remove(id)
    }

    // ── Public single event (must be last) ───────────────────────────────────

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.eventsService.findOne(id)
    }
}