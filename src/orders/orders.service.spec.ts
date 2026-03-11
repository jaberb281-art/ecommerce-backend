import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscountType, OrderStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTx = {
    cart: { findUnique: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    order: { findUnique: jest.fn(), create: jest.fn() },
    product: { findUnique: jest.fn(), update: jest.fn() },
    coupon: { update: jest.fn() },
};

const mockPrismaService = {
    cart: { findUnique: jest.fn() },
    order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
    },
    coupon: { findUnique: jest.fn() },
    product: { count: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    user: { count: jest.fn() },
    $transaction: jest.fn(),
};

const mockCouponsService = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockProduct = {
    id: 'product-123',
    name: 'Victorious XIII',
    price: 6.5,
    stock: 10,
};

const mockCartItem = {
    id: 'item-123',
    productId: mockProduct.id,
    quantity: 2,
    product: mockProduct,
};

const mockCart = {
    id: 'cart-123',
    userId: 'user-123',
    items: [mockCartItem],
};

const mockOrder = {
    id: 'order-123',
    userId: 'user-123',
    total: 13,
    status: OrderStatus.PENDING,
    items: [],
    createdAt: new Date(),
};

const mockCoupon = {
    id: 'coupon-123',
    code: 'SAVE10',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    minOrderValue: null,
    maxUses: null,
    usedCount: 0,
    expiresAt: null,
    isActive: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrdersService', () => {
    let service: OrdersService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrdersService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: CouponsService, useValue: mockCouponsService },
            ],
        }).compile();

        service = module.get<OrdersService>(OrdersService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // CHECKOUT — base cases
    // -------------------------------------------------------------------------

    describe('checkout()', () => {
        it('should throw BadRequestException if cart is empty', async () => {
            mockPrismaService.order.findUnique.mockResolvedValue(null);
            mockPrismaService.cart.findUnique.mockResolvedValue({
                ...mockCart,
                items: [],
            });

            await expect(service.checkout('user-123')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw BadRequestException if cart does not exist', async () => {
            mockPrismaService.order.findUnique.mockResolvedValue(null);
            mockPrismaService.cart.findUnique.mockResolvedValue(null);

            await expect(service.checkout('user-123')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should return existing order when idempotency key already used', async () => {
            mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

            const result = await service.checkout('user-123', 'existing-key');

            expect(result).toEqual(mockOrder);
            expect(mockPrismaService.cart.findUnique).not.toHaveBeenCalled();
        });

        it('should create order successfully inside a transaction', async () => {
            mockPrismaService.order.findUnique.mockResolvedValue(null);
            mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);

            mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
                mockTx.product.update.mockResolvedValue(mockProduct);
                mockTx.order.create.mockResolvedValue(mockOrder);
                mockTx.cartItem.deleteMany.mockResolvedValue({ count: 1 });
                return cb(mockTx);
            });

            await service.checkout('user-123', 'new-key');

            expect(mockPrismaService.$transaction).toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // CHECKOUT — coupon cases
    // -------------------------------------------------------------------------

    describe('checkout() with coupon', () => {
        beforeEach(() => {
            mockPrismaService.order.findUnique.mockResolvedValue(null);
            mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
        });

        it('should apply percentage coupon and decrement total', async () => {
            mockPrismaService.coupon.findUnique.mockResolvedValue(mockCoupon);

            // subtotal = 6.5 * 2 = 13, 10% off = 1.3, discounted total = 11.7
            const discountedOrder = { ...mockOrder, total: 11.7 };

            mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
                mockTx.product.update.mockResolvedValue(mockProduct);
                mockTx.order.create.mockResolvedValue(discountedOrder);
                mockTx.coupon.update.mockResolvedValue({ ...mockCoupon, usedCount: 1 });
                mockTx.cartItem.deleteMany.mockResolvedValue({ count: 1 });
                return cb(mockTx);
            });

            const result = await service.checkout('user-123', undefined, {
                couponId: 'coupon-123',
            });

            expect(result.total).toBe(11.7);
            expect(mockTx.coupon.update).toHaveBeenCalledWith({
                where: { id: 'coupon-123' },
                data: { usedCount: { increment: 1 } },
            });
        });

        it('should apply flat discount coupon', async () => {
            const flatCoupon = {
                ...mockCoupon,
                id: 'coupon-flat',
                discountType: DiscountType.FIXED,
                discountValue: 5,
            };
            mockPrismaService.coupon.findUnique.mockResolvedValue(flatCoupon);

            // subtotal = 13, flat $5 off = 8
            const discountedOrder = { ...mockOrder, total: 8 };

            mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
                mockTx.product.update.mockResolvedValue(mockProduct);
                mockTx.order.create.mockResolvedValue(discountedOrder);
                mockTx.coupon.update.mockResolvedValue({ ...flatCoupon, usedCount: 1 });
                mockTx.cartItem.deleteMany.mockResolvedValue({ count: 1 });
                return cb(mockTx);
            });

            const result = await service.checkout('user-123', undefined, {
                couponId: 'coupon-flat',
            });

            expect(result.total).toBe(8);
        });

        it('should throw if coupon is inactive', async () => {
            mockPrismaService.coupon.findUnique.mockResolvedValue({
                ...mockCoupon,
                isActive: false,
            });

            await expect(
                service.checkout('user-123', undefined, { couponId: 'coupon-123' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw if coupon is expired', async () => {
            mockPrismaService.coupon.findUnique.mockResolvedValue({
                ...mockCoupon,
                expiresAt: new Date('2020-01-01'),
            });

            await expect(
                service.checkout('user-123', undefined, { couponId: 'coupon-123' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw if coupon usage limit is reached', async () => {
            mockPrismaService.coupon.findUnique.mockResolvedValue({
                ...mockCoupon,
                maxUses: 5,
                usedCount: 5,
            });

            await expect(
                service.checkout('user-123', undefined, { couponId: 'coupon-123' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw if order total is below minOrderValue', async () => {
            mockPrismaService.coupon.findUnique.mockResolvedValue({
                ...mockCoupon,
                minOrderValue: 50, // subtotal is only 13
            });

            await expect(
                service.checkout('user-123', undefined, { couponId: 'coupon-123' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should NOT increment usedCount if no coupon provided', async () => {
            mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
                mockTx.product.update.mockResolvedValue(mockProduct);
                mockTx.order.create.mockResolvedValue(mockOrder);
                mockTx.cartItem.deleteMany.mockResolvedValue({ count: 1 });
                return cb(mockTx);
            });

            await service.checkout('user-123');

            expect(mockTx.coupon.update).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // GET MY ORDERS
    // -------------------------------------------------------------------------

    describe('getMyOrders()', () => {
        it('should return paginated orders for a user', async () => {
            mockPrismaService.order.findMany.mockResolvedValue([mockOrder]);
            mockPrismaService.order.count.mockResolvedValue(1);

            const result = await service.getMyOrders('user-123', { page: 1, limit: 10 });

            expect(result.data).toHaveLength(1);
            expect(result.meta).toMatchObject({
                total: 1,
                page: 1,
                limit: 10,
                totalPages: 1,
            });
        });

        it('should use default pagination when no options provided', async () => {
            mockPrismaService.order.findMany.mockResolvedValue([]);
            mockPrismaService.order.count.mockResolvedValue(0);

            const result = await service.getMyOrders('user-123');

            expect(result.meta.page).toBe(1);
            expect(result.meta.limit).toBe(10);
        });
    });

    // -------------------------------------------------------------------------
    // GET ALL ORDERS
    // -------------------------------------------------------------------------

    describe('getAllOrders()', () => {
        it('should return paginated orders for admin', async () => {
            mockPrismaService.order.findMany.mockResolvedValue([mockOrder]);
            mockPrismaService.order.count.mockResolvedValue(1);

            const result = await service.getAllOrders({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.meta.total).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    // UPDATE STATUS
    // -------------------------------------------------------------------------

    describe('updateStatus()', () => {
        it('should throw NotFoundException for non-existent order', async () => {
            mockPrismaService.order.findUnique.mockResolvedValue(null);

            await expect(
                service.updateStatus('non-existent', OrderStatus.SHIPPED),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException for invalid status transition', async () => {
            mockPrismaService.order.findUnique.mockResolvedValue({
                ...mockOrder,
                status: OrderStatus.COMPLETED,
            });

            await expect(
                service.updateStatus('order-123', OrderStatus.PENDING),
            ).rejects.toThrow(BadRequestException);
        });

        it('should update status for valid transition PENDING → SHIPPED', async () => {
            mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
            mockPrismaService.order.update.mockResolvedValue({
                ...mockOrder,
                status: OrderStatus.SHIPPED,
            });

            const result = await service.updateStatus('order-123', OrderStatus.SHIPPED);

            expect(result.status).toBe(OrderStatus.SHIPPED);
        });

        it('should allow PENDING → CANCELLED transition', async () => {
            mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
            mockPrismaService.order.update.mockResolvedValue({
                ...mockOrder,
                status: OrderStatus.CANCELLED,
            });

            const result = await service.updateStatus('order-123', OrderStatus.CANCELLED);

            expect(result.status).toBe(OrderStatus.CANCELLED);
        });
    });

    // -------------------------------------------------------------------------
    // GET ADMIN STATS
    // -------------------------------------------------------------------------

    describe('getAdminStats()', () => {
        it('should return revenue, order count and product count', async () => {
            mockPrismaService.order.aggregate.mockResolvedValue({ _sum: { total: 150.5 } });
            mockPrismaService.order.count.mockResolvedValue(10);
            mockPrismaService.product.count.mockResolvedValue(25);
            mockPrismaService.user.count.mockResolvedValue(5);

            const result = await service.getAdminStats();

            expect(result).toEqual({
                totalRevenue: 150.5,
                totalOrders: 10,
                totalProducts: 25,
                totalUsers: 5,
            });
        });

        it('should return 0 for totalRevenue when no orders exist', async () => {
            mockPrismaService.order.aggregate.mockResolvedValue({ _sum: { total: null } });
            mockPrismaService.order.count.mockResolvedValue(0);
            mockPrismaService.product.count.mockResolvedValue(0);
            mockPrismaService.user.count.mockResolvedValue(0);

            const result = await service.getAdminStats();

            expect(result.totalRevenue).toBe(0);
        });
    });
});