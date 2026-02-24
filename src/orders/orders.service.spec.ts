import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTx = {
    cart: { findUnique: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    order: { findUnique: jest.fn(), create: jest.fn() },
    product: { findUnique: jest.fn(), update: jest.fn() },
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
    product: { count: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
};

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
            ],
        }).compile();

        service = module.get<OrdersService>(OrdersService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // CHECKOUT
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

            // Full tx mock including product.findUnique and product.update
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

            const result = await service.getAdminStats();

            expect(result).toEqual({
                totalRevenue: 150.5,
                totalOrders: 10,
                totalProducts: 25,
            });
        });

        it('should return 0 for totalRevenue when no orders exist', async () => {
            mockPrismaService.order.aggregate.mockResolvedValue({ _sum: { total: null } });
            mockPrismaService.order.count.mockResolvedValue(0);
            mockPrismaService.product.count.mockResolvedValue(0);

            const result = await service.getAdminStats();

            expect(result.totalRevenue).toBe(0);
        });
    });
});