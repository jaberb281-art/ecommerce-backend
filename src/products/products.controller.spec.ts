import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockProductsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockCloudinaryService = {
  uploadImage: jest.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockProduct = {
  id: 'product-123',
  name: 'Victorious XIII',
  description: 'Limited edition streetwear piece',
  price: 6.5,
  stock: 10,
  images: ['https://res.cloudinary.com/demo/image/upload/v1/shbash/product1.jpg'],
  categoryId: 'category-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPaginatedResponse = {
  data: [mockProduct],
  meta: { totalItems: 1, currentPage: 1, itemsPerPage: 10, totalPages: 1 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockProductsService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll()', () => {
    it('should return paginated products', async () => {
      mockProductsService.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findAll({ page: 1, limit: 10 } as any);

      expect(mockProductsService.findAll).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne()', () => {
    it('should return a product by id', async () => {
      mockProductsService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne('product-123');

      expect(mockProductsService.findOne).toHaveBeenCalledWith('product-123');
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException for missing product', async () => {
      mockProductsService.findOne.mockRejectedValue(
        new NotFoundException({ code: 'PRODUCT_NOT_FOUND' }),
      );

      await expect(controller.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create()', () => {
    it('should create a product', async () => {
      mockProductsService.create.mockResolvedValue(mockProduct);

      const dto = {
        name: 'Victorious XIII',
        price: 6.5,
        stock: 10,
        images: ['https://res.cloudinary.com/demo/image/upload/v1/shbash/product1.jpg'],
        categoryId: 'category-123',
      };

      const result = await controller.create(dto as any);

      expect(mockProductsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('uploadImage()', () => {
    it('should upload image and return url', async () => {
      mockCloudinaryService.uploadImage.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/shbash/test.jpg',
      });

      const mockFile = { originalname: 'test.jpg', buffer: Buffer.from('') } as any;
      const result = await controller.uploadImage(mockFile);

      expect(mockCloudinaryService.uploadImage).toHaveBeenCalledWith(mockFile);
      expect(result).toHaveProperty('url');
    });

    it('should throw BadRequestException when no file uploaded', async () => {
      await expect(controller.uploadImage(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update()', () => {
    it('should update a product', async () => {
      const updated = { ...mockProduct, name: 'Updated Name' };
      mockProductsService.update.mockResolvedValue(updated);

      const result = await controller.update('product-123', { name: 'Updated Name' } as any);

      expect(mockProductsService.update).toHaveBeenCalledWith('product-123', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('remove()', () => {
    it('should delete a product', async () => {
      mockProductsService.remove.mockResolvedValue(mockProduct);

      const result = await controller.remove('product-123');

      expect(mockProductsService.remove).toHaveBeenCalledWith('product-123');
      expect(result).toEqual(mockProduct);
    });
  });
});