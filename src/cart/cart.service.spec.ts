import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService = {
  cart: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  cartItem: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
  },
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

const mockCart = {
  id: 'cart-123',
  userId: 'user-123',
  items: [],
};

const mockCartItem = {
  id: 'item-123',
  cartId: 'cart-123',
  productId: 'product-123',
  quantity: 2,
  product: { id: mockProduct.id, name: mockProduct.name, price: mockProduct.price },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // GET OR CREATE CART
  // -------------------------------------------------------------------------

  describe('getOrCreateCart()', () => {
    it('should return existing cart via upsert', async () => {
      mockPrismaService.cart.upsert.mockResolvedValue(mockCart);

      const result = await service.getOrCreateCart('user-123');

      expect(mockPrismaService.cart.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        create: { userId: 'user-123' },
        update: {},
        include: { items: true },
      });
      expect(result).toEqual(mockCart);
    });

    it('should create a new cart if one does not exist', async () => {
      const newCart = { id: 'new-cart-123', userId: 'new-user', items: [] };
      mockPrismaService.cart.upsert.mockResolvedValue(newCart);

      const result = await service.getOrCreateCart('new-user');

      expect(result).toEqual(newCart);
    });
  });

  // -------------------------------------------------------------------------
  // ADD TO CART
  // -------------------------------------------------------------------------

  describe('addToCart()', () => {
    it('should add item to cart successfully', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) =>
        cb(mockPrismaService),
      );
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.cart.upsert.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findUnique.mockResolvedValue(null);
      mockPrismaService.cartItem.upsert.mockResolvedValue(mockCartItem);

      const result = await service.addToCart('user-123', 'product-123', 2);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockCartItem);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) =>
        cb(mockPrismaService),
      );
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.addToCart('user-123', 'non-existent', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if quantity exceeds stock', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) =>
        cb(mockPrismaService),
      );
      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 2,
      });
      mockPrismaService.cart.upsert.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        service.addToCart('user-123', 'product-123', 5), // requesting 5, only 2 in stock
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if existing cart quantity + new quantity exceeds stock', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) =>
        cb(mockPrismaService),
      );
      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 5,
      });
      mockPrismaService.cart.upsert.mockResolvedValue(mockCart);
      // Already 4 in cart
      mockPrismaService.cartItem.findUnique.mockResolvedValue({
        ...mockCartItem,
        quantity: 4,
      });

      await expect(
        service.addToCart('user-123', 'product-123', 2), // 4 + 2 = 6 > 5
      ).rejects.toThrow(BadRequestException);
    });

    it('should run inside a transaction', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) =>
        cb(mockPrismaService),
      );
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.cart.upsert.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findUnique.mockResolvedValue(null);
      mockPrismaService.cartItem.upsert.mockResolvedValue(mockCartItem);

      await service.addToCart('user-123', 'product-123', 1);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // GET CART
  // -------------------------------------------------------------------------

  describe('getCart()', () => {
    it('should return cart with calculated total', async () => {
      const cartWithItems = {
        ...mockCart,
        items: [
          { ...mockCartItem, quantity: 2, product: { ...mockProduct, price: 6.5 } },
        ],
      };
      mockPrismaService.cart.findUnique.mockResolvedValue(cartWithItems);

      const result = await service.getCart('user-123');

      expect(result).toHaveProperty('total', 13); // 2 * 6.5 = 13
    });

    it('should return empty cart with total 0 when no cart exists', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(null);

      const result = await service.getCart('user-123');

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // REMOVE FROM CART
  // -------------------------------------------------------------------------

  describe('removeFromCart()', () => {
    it('should remove item from cart', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findUnique.mockResolvedValue(mockCartItem);
      mockPrismaService.cartItem.delete.mockResolvedValue(mockCartItem);

      const result = await service.removeFromCart('user-123', 'product-123');

      expect(mockPrismaService.cartItem.delete).toHaveBeenCalledWith({
        where: { id: mockCartItem.id },
      });
      expect(result).toEqual(mockCartItem);
    });

    it('should throw NotFoundException if cart does not exist', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(null);

      await expect(
        service.removeFromCart('user-123', 'product-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if item not in cart', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        service.removeFromCart('user-123', 'non-existent-product'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // CLEAR CART
  // -------------------------------------------------------------------------

  describe('clearCart()', () => {
    it('should clear all items from cart', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.clearCart('user-123');

      expect(mockPrismaService.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: mockCart.id },
      });
      expect(result).toEqual({ count: 3 });
    });

    it('should throw NotFoundException if cart does not exist', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(null);

      await expect(service.clearCart('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});