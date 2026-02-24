import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

const mockCategoriesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockCategory = {
  id: 'category-123',
  name: 'Stickers',
  productCount: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create()', () => {
    it('should create a category', async () => {
      mockCategoriesService.create.mockResolvedValue(mockCategory);

      const result = await controller.create({ name: 'Stickers' });

      expect(mockCategoriesService.create).toHaveBeenCalledWith({ name: 'Stickers' });
      expect(result).toEqual(mockCategory);
    });

    it('should throw ConflictException for duplicate name', async () => {
      mockCategoriesService.create.mockRejectedValue(
        new ConflictException({ code: 'CATEGORY_ALREADY_EXISTS' }),
      );

      await expect(controller.create({ name: 'Stickers' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll()', () => {
    it('should return all categories', async () => {
      mockCategoriesService.findAll.mockResolvedValue([mockCategory]);

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('productCount');
    });
  });

  describe('findOne()', () => {
    it('should return a single category', async () => {
      mockCategoriesService.findOne.mockResolvedValue(mockCategory);

      const result = await controller.findOne('category-123');

      expect(mockCategoriesService.findOne).toHaveBeenCalledWith('category-123');
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException for missing category', async () => {
      mockCategoriesService.findOne.mockRejectedValue(
        new NotFoundException({ code: 'CATEGORY_NOT_FOUND' }),
      );

      await expect(controller.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update()', () => {
    it('should update a category', async () => {
      const updated = { ...mockCategory, name: 'Clothing' };
      mockCategoriesService.update.mockResolvedValue(updated);

      const result = await controller.update('category-123', { name: 'Clothing' });

      expect(mockCategoriesService.update).toHaveBeenCalledWith(
        'category-123',
        { name: 'Clothing' },
      );
      expect(result.name).toBe('Clothing');
    });
  });

  describe('remove()', () => {
    it('should delete a category', async () => {
      mockCategoriesService.remove.mockResolvedValue(mockCategory);

      const result = await controller.remove('category-123');

      expect(mockCategoriesService.remove).toHaveBeenCalledWith('category-123');
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException for missing category', async () => {
      mockCategoriesService.remove.mockRejectedValue(
        new NotFoundException({ code: 'CATEGORY_NOT_FOUND' }),
      );

      await expect(controller.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});