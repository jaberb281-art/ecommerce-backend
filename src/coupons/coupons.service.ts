import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscountType } from '@prisma/client';

export interface CreateCouponDto {
    code: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderValue?: number;
    maxUses?: number;
    expiresAt?: string;
    isActive?: boolean;
}

@Injectable()
export class CouponsService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.coupon.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { orders: true } } },
        })
    }

    async findOne(id: string) {
        const coupon = await this.prisma.coupon.findUnique({ where: { id } })
        if (!coupon) throw new NotFoundException('Coupon not found')
        return coupon
    }

    async validate(code: string, orderTotal: number) {
        const coupon = await this.prisma.coupon.findUnique({ where: { code } })

        if (!coupon || !coupon.isActive) {
            throw new BadRequestException({ code: 'INVALID_COUPON', message: 'Invalid or inactive coupon' })
        }

        if (coupon.expiresAt && new Date() > coupon.expiresAt) {
            throw new BadRequestException({ code: 'COUPON_EXPIRED', message: 'Coupon has expired' })
        }

        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
            throw new BadRequestException({ code: 'COUPON_EXHAUSTED', message: 'Coupon usage limit reached' })
        }

        if (coupon.minOrderValue && orderTotal < coupon.minOrderValue) {
            throw new BadRequestException({
                code: 'ORDER_TOO_SMALL',
                message: `Minimum order value is $${coupon.minOrderValue}`,
            })
        }

        const discount = coupon.discountType === DiscountType.PERCENTAGE
            ? (orderTotal * coupon.discountValue) / 100
            : coupon.discountValue

        return {
            couponId: coupon.id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discount: Math.min(discount, orderTotal),
            finalTotal: Math.max(orderTotal - discount, 0),
        }
    }

    async create(dto: CreateCouponDto) {
        return this.prisma.coupon.create({
            data: {
                code: dto.code.toUpperCase(),
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                minOrderValue: dto.minOrderValue,
                maxUses: dto.maxUses,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
                isActive: dto.isActive ?? true,
            },
        })
    }

    async update(id: string, dto: Partial<CreateCouponDto>) {
        await this.findOne(id)
        return this.prisma.coupon.update({
            where: { id },
            data: {
                ...(dto.code && { code: dto.code.toUpperCase() }),
                ...(dto.discountType && { discountType: dto.discountType }),
                ...(dto.discountValue !== undefined && { discountValue: dto.discountValue }),
                ...(dto.minOrderValue !== undefined && { minOrderValue: dto.minOrderValue }),
                ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
                ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        })
    }

    async remove(id: string) {
        await this.findOne(id)
        return this.prisma.coupon.delete({ where: { id } })
    }
}