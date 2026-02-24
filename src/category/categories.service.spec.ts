import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService = {
  category: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockCategory = {
  id: 'category-123',
  name: 'Stickers',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCategoryWithCount = {
  ...mockCategory,
  _count: { products: 5 },
};

const mockCategoryWithProducts = {
  ...mockCategory,
  products: [
    {
      id: 'product-123',
      name: 'Victorious XIII',
      price: 6.5,
      stock: 10,
      images: [],
    },
  ],
  _count: { products: 1 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  describe('create()', () => {
    it('should create and return a category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);
      mockPrismaService.category.create.mockResolvedValue(mockCategory);

      const result = await service.create({ name: 'Stickers' });

      expect(mockPrismaService.category.create).toHaveBeenCalledWith({
        data: { name: 'Stickers' },
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw ConflictException if category name already exists', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

      await expect(service.create({ name: 'Stickers' })).rejects.toThrow(
        ConflictException,
      );

      // Should never attempt to create
      expect(mockPrismaService.category.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // FIND ALL
  // -------------------------------------------------------------------------

  describe('findAll()', () => {
    it('should return all categories with product count', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([
        mockCategoryWithCount,
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('productCount', 5);
      // Should not expose raw _count
      expect(result[0]).not.toHaveProperty('_count');
    });

    it('should return empty array when no categories exist', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // FIND ONE
  // -------------------------------------------------------------------------

  describe('findOne()', () => {
    it('should return a category with its products and product count', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(
        mockCategoryWithProducts,
      );

      const result = await service.findOne('category-123');

      expect(result).toHaveProperty('name', 'Stickers');
      expect(result).toHaveProperty('productCount', 1);
      expect(result).toHaveProperty('products');
      expect(result).not.toHaveProperty('_count');
    });

    it('should throw NotFoundException for non-existent category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------

  describe('update()', () => {
    it('should update and return the category', async () => {
      const updatedCategory = { ...mockCategory, name: 'Clothing' };
      // First call is findOne check, second is duplicate name check
      mockPrismaService.category.findUnique
        .mockResolvedValueOnce(mockCategoryWithProducts) // findOne
        .mockResolvedValueOnce(null); // duplicate name check
      mockPrismaService.category.update.mockResolvedValue(updatedCategory);

      const result = await service.update('category-123', { name: 'Clothing' });

      expect(result.name).toBe('Clothing');
    });

    it('should throw NotFoundException for non-existent category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'Clothing' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.category.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if new name already taken by another category', async () => {
      const otherCategory = { ...mockCategory, id: 'other-category-456' };
      mockPrismaService.category.findUnique
        .mockResolvedValueOnce(mockCategoryWithProducts) // findOne
        .mockResolvedValueOnce(otherCategory); // duplicate name check — different id

      await expect(
        service.update('category-123', { name: 'Stickers' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.category.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // REMOVE
  // -------------------------------------------------------------------------

  describe('remove()', () => {
    it('should delete the category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(
        mockCategoryWithProducts,
      );
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);

      const result = await service.remove('category-123');

      expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
        where: { id: 'category-123' },
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException for non-existent category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.category.delete).not.toHaveBeenCalled();
    });
  });
});