import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrdersService = {
    checkout: jest.fn(),
    getMyOrders: jest.fn(),
    getAllOrders: jest.fn(),
    getAdminStats: jest.fn(),
    updateStatus: jest.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockOrder = {
    id: 'order-123',
    userId: 'user-123',
    total: 13,
    status: OrderStatus.PENDING,
    items: [],
    createdAt: new Date(),
};

const mockPaginatedResponse = {
    data: [mockOrder],
    meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

// Fix: req.user must use 'sub' not 'id' to match JwtStrategy payload
const mockRequest = (userId: string) => ({
    user: { id: userId, email: 'test@example.com', role: 'USER' },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrdersController', () => {
    let controller: OrdersController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrdersController],
            providers: [
                { provide: OrdersService, useValue: mockOrdersService },
            ],
        }).compile();

        controller = module.get<OrdersController>(OrdersController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // CHECKOUT
    // -------------------------------------------------------------------------

    describe('checkout()', () => {
        it('should call service with userId from req.user.sub and idempotency key', async () => {
            mockOrdersService.checkout.mockResolvedValue(mockOrder);

            const req = mockRequest('user-123') as any;
            const result = await controller.checkout(req, 'test-key-123');

            expect(mockOrdersService.checkout).toHaveBeenCalledWith(
                'user-123',
                'test-key-123',
            );
            expect(result).toEqual(mockOrder);
        });

        it('should call service without idempotency key when not provided', async () => {
            mockOrdersService.checkout.mockResolvedValue(mockOrder);

            const req = mockRequest('user-123') as any;
            await controller.checkout(req, undefined);

            expect(mockOrdersService.checkout).toHaveBeenCalledWith(
                'user-123',
                undefined,
            );
        });

        it('should throw BadRequestException when cart is empty', async () => {
            mockOrdersService.checkout.mockRejectedValue(
                new BadRequestException({ code: 'CART_EMPTY' }),
            );

            const req = mockRequest('user-123') as any;
            await expect(controller.checkout(req, undefined)).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    // -------------------------------------------------------------------------
    // GET MY ORDERS
    // -------------------------------------------------------------------------

    describe('getMyOrders()', () => {
        it('should return paginated orders for current user', async () => {
            mockOrdersService.getMyOrders.mockResolvedValue(mockPaginatedResponse);

            const req = mockRequest('user-123') as any;
            const result = await controller.getMyOrders(req, '1', '10');

            expect(mockOrdersService.getMyOrders).toHaveBeenCalledWith('user-123', {
                page: 1,
                limit: 10,
            });
            expect(result.data).toHaveLength(1);
        });

        it('should use default pagination when no params provided', async () => {
            mockOrdersService.getMyOrders.mockResolvedValue(mockPaginatedResponse);

            const req = mockRequest('user-123') as any;
            await controller.getMyOrders(req, undefined, undefined);

            expect(mockOrdersService.getMyOrders).toHaveBeenCalledWith('user-123', {
                page: 1,
                limit: 10,
            });
        });
    });

    // -------------------------------------------------------------------------
    // GET ALL ORDERS (Admin)
    // -------------------------------------------------------------------------

    describe('getAllOrders()', () => {
        it('should return paginated orders for admin', async () => {
            mockOrdersService.getAllOrders.mockResolvedValue(mockPaginatedResponse);

            const result = await controller.getAllOrders('1', '20');

            expect(mockOrdersService.getAllOrders).toHaveBeenCalledWith({
                page: 1,
                limit: 20,
            });
            expect(result.data).toHaveLength(1);
        });

        it('should use default pagination when no params provided', async () => {
            mockOrdersService.getAllOrders.mockResolvedValue(mockPaginatedResponse);

            await controller.getAllOrders(undefined, undefined);

            expect(mockOrdersService.getAllOrders).toHaveBeenCalledWith({
                page: 1,
                limit: 20,
            });
        });
    });

    // -------------------------------------------------------------------------
    // GET ADMIN STATS
    // -------------------------------------------------------------------------

    describe('getStats()', () => {
        it('should return admin stats', async () => {
            const mockStats = {
                totalRevenue: 150.5,
                totalOrders: 10,
                totalProducts: 25,
            };
            mockOrdersService.getAdminStats.mockResolvedValue(mockStats);

            const result = await controller.getStats();

            expect(result).toEqual(mockStats);
            expect(result).toHaveProperty('totalRevenue');
            expect(result).toHaveProperty('totalOrders');
            expect(result).toHaveProperty('totalProducts');
        });
    });

    // -------------------------------------------------------------------------
    // UPDATE STATUS
    // -------------------------------------------------------------------------

    describe('updateStatus()', () => {
        it('should update order status successfully', async () => {
            const updatedOrder = { ...mockOrder, status: OrderStatus.SHIPPED };
            mockOrdersService.updateStatus.mockResolvedValue(updatedOrder);

            const result = await controller.updateStatus('order-123', {
                status: OrderStatus.SHIPPED,
            } as any);

            expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
                'order-123',
                OrderStatus.SHIPPED,
            );
            expect(result.status).toBe(OrderStatus.SHIPPED);
        });

        it('should throw NotFoundException for non-existent order', async () => {
            mockOrdersService.updateStatus.mockRejectedValue(
                new NotFoundException({ code: 'ORDER_NOT_FOUND' }),
            );

            await expect(
                controller.updateStatus('non-existent', { status: OrderStatus.SHIPPED } as any),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException for invalid status transition', async () => {
            mockOrdersService.updateStatus.mockRejectedValue(
                new BadRequestException({ code: 'INVALID_STATUS_TRANSITION' }),
            );

            await expect(
                controller.updateStatus('order-123', { status: OrderStatus.PENDING } as any),
            ).rejects.toThrow(BadRequestException);
        });
    });
});