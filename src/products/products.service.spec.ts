import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService = {
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockCategory = {
  id: 'category-123',
  name: 'Stickers',
};

const mockProduct = {
  id: 'product-123',
  name: 'Victorious XIII',
  description: 'Limited edition streetwear piece',
  price: 6.5,
  stock: 10,
  images: ['https://res.cloudinary.com/demo/image/upload/v1/shbash/product1.jpg'],
  categoryId: mockCategory.id,
  category: mockCategory,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCreateDto = {
  name: 'Victorious XIII',
  description: 'Limited edition streetwear piece',
  price: 6.5,
  stock: 10,
  images: ['https://res.cloudinary.com/demo/image/upload/v1/shbash/product1.jpg'],
  categoryId: 'category-123',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  describe('create()', () => {
    it('should create and return a product', async () => {
      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(mockCreateDto);

      expect(mockPrismaService.product.create).toHaveBeenCalledWith({
        data: {
          name: mockCreateDto.name,
          description: mockCreateDto.description,
          price: mockCreateDto.price,
          stock: mockCreateDto.stock,
          images: mockCreateDto.images,
          categoryId: mockCreateDto.categoryId,
        },
        include: { category: true },
      });
      expect(result).toEqual(mockProduct);
    });
  });

  // -------------------------------------------------------------------------
  // FIND ALL
  // -------------------------------------------------------------------------

  describe('findAll()', () => {
    it('should return paginated products', async () => {
      mockPrismaService.product.count.mockResolvedValue(1);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toMatchObject({
        totalItems: 1,
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should filter by categoryId when provided', async () => {
      mockPrismaService.product.count.mockResolvedValue(1);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      await service.findAll({ page: 1, limit: 10, categoryId: 'category-123' });

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'category-123' }),
        }),
      );
    });

    it('should filter by search term when provided', async () => {
      mockPrismaService.product.count.mockResolvedValue(1);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      await service.findAll({ page: 1, limit: 10, search: 'victorious' });

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'victorious', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should return correct hasNextPage when more pages exist', async () => {
      mockPrismaService.product.count.mockResolvedValue(25);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // FIND ONE
  // -------------------------------------------------------------------------

  describe('findOne()', () => {
    it('should return a product by id', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne('product-123');

      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------

  describe('update()', () => {
    it('should update and return the product', async () => {
      const updatedProduct = { ...mockProduct, name: 'Updated Name' };
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.update.mockResolvedValue(updatedProduct);

      const result = await service.update('product-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException for non-existent product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'Updated Name' }),
      ).rejects.toThrow(NotFoundException);

      // Should never call update on non-existent product
      expect(mockPrismaService.product.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // REMOVE
  // -------------------------------------------------------------------------

  describe('remove()', () => {
    it('should delete the product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.delete.mockResolvedValue(mockProduct);

      const result = await service.remove('product-123');

      expect(mockPrismaService.product.delete).toHaveBeenCalledWith({
        where: { id: 'product-123' },
      });
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );

      // Should never call delete on non-existent product
      expect(mockPrismaService.product.delete).not.toHaveBeenCalled();
    });
  });
});