import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateEventDto, UpdateEventDto } from './event.dto'
import { EventStatus } from '@prisma/client'

@Injectable()
export class EventsService {
    constructor(private prisma: PrismaService) { }

    // Public: only published events
    async findAll(status?: EventStatus) {
        return this.prisma.event.findMany({
            where: {
                isPublished: true,
                ...(status ? { status } : {}),
            },
            orderBy: { startDate: 'asc' },
        })
    }

    // Admin: all events
    async findAllAdmin(status?: EventStatus) {
        return this.prisma.event.findMany({
            where: status ? { status } : {},
            orderBy: { startDate: 'asc' },
        })
    }

    async findOne(id: string) {
        const event = await this.prisma.event.findUnique({ where: { id } })
        if (!event) throw new NotFoundException('Event not found')
        return event
    }

    async create(dto: CreateEventDto) {
        return this.prisma.event.create({
            data: {
                ...dto,
                startDate: new Date(dto.startDate),
                endDate: dto.endDate ? new Date(dto.endDate) : null,
            },
        })
    }

    async update(id: string, dto: UpdateEventDto) {
        await this.findOne(id)
        return this.prisma.event.update({
            where: { id },
            data: {
                ...dto,
                ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
                ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
            },
        })
    }

    async remove(id: string) {
        await this.findOne(id)
        return this.prisma.event.delete({ where: { id } })
    }

    async togglePublish(id: string) {
        const event = await this.findOne(id)
        return this.prisma.event.update({
            where: { id },
            data: { isPublished: !event.isPublished },
        })
    }
}