import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateAddressDto {
    fullName!: string;
    phone!: string;
    building?: string;
    block?: string;
    street!: string;
    city!: string;
    state?: string;
    zip?: string;
    country!: string;
    isDefault?: boolean;
}

@Injectable()
export class AddressesService {
    constructor(private prisma: PrismaService) { }

    async findAll(userId: string) {
        return this.prisma.address.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
    }

    async create(userId: string, dto: CreateAddressDto) {
        if (dto.isDefault) {
            await this.prisma.address.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        const count = await this.prisma.address.count({ where: { userId } });
        const isDefault = dto.isDefault ?? count === 0;

        // Combine building + block into street until migration runs
        const streetFull = [dto.building, dto.block, dto.street]
            .filter(Boolean)
            .join(', ');

        return this.prisma.address.create({
            data: {
                userId,
                fullName: dto.fullName,
                phone: dto.phone,
                street: streetFull,
                city: dto.city,
                state: dto.state ?? '',
                zip: dto.zip ?? '',
                country: dto.country,
                isDefault,
            },
        });
    }

    async update(userId: string, addressId: string, dto: Partial<CreateAddressDto>) {
        await this.assertOwnership(userId, addressId);

        if (dto.isDefault) {
            await this.prisma.address.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        const streetFull = [dto.building, dto.block, dto.street]
            .filter(Boolean)
            .join(', ');

        return this.prisma.address.update({
            where: { id: addressId },
            data: {
                ...(dto.fullName && { fullName: dto.fullName }),
                ...(dto.phone && { phone: dto.phone }),
                ...(streetFull && { street: streetFull }),
                ...(dto.city && { city: dto.city }),
                ...(dto.state !== undefined && { state: dto.state }),
                ...(dto.zip !== undefined && { zip: dto.zip }),
                ...(dto.country && { country: dto.country }),
                ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
            },
        });
    }

    async remove(userId: string, addressId: string) {
        await this.assertOwnership(userId, addressId);
        await this.prisma.address.delete({ where: { id: addressId } });

        const remaining = await this.prisma.address.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        if (remaining) {
            await this.prisma.address.update({
                where: { id: remaining.id },
                data: { isDefault: true },
            });
        }

        return { success: true };
    }

    async setDefault(userId: string, addressId: string) {
        await this.assertOwnership(userId, addressId);

        await this.prisma.address.updateMany({
            where: { userId },
            data: { isDefault: false },
        });

        return this.prisma.address.update({
            where: { id: addressId },
            data: { isDefault: true },
        });
    }

    private async assertOwnership(userId: string, addressId: string) {
        const address = await this.prisma.address.findUnique({
            where: { id: addressId },
        });
        if (!address) throw new NotFoundException('Address not found');
        if (address.userId !== userId) throw new ForbiddenException('Not your address');
        return address;
    }
}