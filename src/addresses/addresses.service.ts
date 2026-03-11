import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateAddressDto {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
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
        // If new address is default, unset all others first
        if (dto.isDefault) {
            await this.prisma.address.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        // If this is the user's first address, make it default automatically
        const count = await this.prisma.address.count({ where: { userId } });
        const isDefault = dto.isDefault ?? count === 0;

        return this.prisma.address.create({
            data: { ...dto, userId, isDefault },
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

        return this.prisma.address.update({
            where: { id: addressId },
            data: dto,
        });
    }

    async remove(userId: string, addressId: string) {
        await this.assertOwnership(userId, addressId);
        await this.prisma.address.delete({ where: { id: addressId } });

        // If deleted address was default, promote the most recent one
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