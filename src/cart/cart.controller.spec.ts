import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockCartService = {
  getCart: jest.fn(),
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  clearCart: jest.fn(),
};

const mockCart = {
  id: 'cart-123',
  userId: 'user-123',
  items: [],
  total: 0,
};

const mockCartItem = {
  id: 'item-123',
  cartId: 'cart-123',
  productId: 'product-123',
  quantity: 2,
  product: { id: 'product-123', name: 'Victorious XIII', price: 6.5 },
};

const mockRequest = (userId: string) => ({
  user: { sub: userId, email: 'test@example.com', role: 'USER' },
});

describe('CartController', () => {
  let controller: CartController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: mockCartService },
      ],
    }).compile();

    controller = module.get<CartController>(CartController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCart()', () => {
    it('should return cart for current user', async () => {
      mockCartService.getCart.mockResolvedValue(mockCart);

      const req = mockRequest('user-123') as any;
      const result = await controller.getCart(req);

      expect(mockCartService.getCart).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockCart);
    });
  });

  describe('addItem()', () => {
    it('should add item to cart', async () => {
      mockCartService.addToCart.mockResolvedValue(mockCartItem);

      const req = mockRequest('user-123') as any;
      const dto = { productId: 'product-123', quantity: 2 };
      const result = await controller.addItem(req, dto as any);

      expect(mockCartService.addToCart).toHaveBeenCalledWith(
        'user-123',
        'product-123',
        2,
      );
      expect(result).toEqual(mockCartItem);
    });

    it('should throw BadRequestException on insufficient stock', async () => {
      mockCartService.addToCart.mockRejectedValue(
        new BadRequestException({ code: 'INSUFFICIENT_STOCK' }),
      );

      const req = mockRequest('user-123') as any;
      await expect(
        controller.addItem(req, { productId: 'product-123', quantity: 99 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('clear()', () => {
    it('should clear cart for current user', async () => {
      mockCartService.clearCart.mockResolvedValue({ count: 3 });

      const req = mockRequest('user-123') as any;
      const result = await controller.clear(req);

      expect(mockCartService.clearCart).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('removeItem()', () => {
    it('should remove item from cart', async () => {
      mockCartService.removeFromCart.mockResolvedValue(mockCartItem);

      const req = mockRequest('user-123') as any;
      const result = await controller.removeItem(req, 'product-123');

      expect(mockCartService.removeFromCart).toHaveBeenCalledWith(
        'user-123',
        'product-123',
      );
      expect(result).toEqual(mockCartItem);
    });

    it('should throw NotFoundException when item not in cart', async () => {
      mockCartService.removeFromCart.mockRejectedValue(
        new NotFoundException({ code: 'CART_ITEM_NOT_FOUND' }),
      );

      const req = mockRequest('user-123') as any;
      await expect(
        controller.removeItem(req, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});