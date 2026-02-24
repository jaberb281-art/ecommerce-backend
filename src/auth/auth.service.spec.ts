import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock bcrypt at module level — avoids "Cannot redefine property" error
// that occurs when using jest.spyOn on bcrypt's non-configurable properties
// ---------------------------------------------------------------------------
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

import * as bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = { BCRYPT_ROUNDS: 10 };
    return config[key] ?? defaultValue;
  }),
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  password: 'hashed_password',
  name: 'Test User',
  role: 'USER',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------------------------

  describe('login()', () => {
    const loginDto = { email: 'test@example.com', password: 'Password123!' };

    it('should return access token and user on valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('access_token', 'mock.jwt.token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should always call bcrypt.compare even if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);

      // bcrypt.compare must always run — never short-circuit on missing user
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // REGISTER
  // -------------------------------------------------------------------------

  describe('register()', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'Password123!',
      name: 'New User',
    };

    it('should create a new user and return data without password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: registerDto.email,
        name: registerDto.name,
        role: 'USER',
        createdAt: new Date(),
      });

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('email', registerDto.email);
      expect(result).not.toHaveProperty('password');
    });

    it('should hash the password before saving', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: registerDto.email,
        name: registerDto.name,
        role: 'USER',
        createdAt: new Date(),
      });

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET PROFILE
  // -------------------------------------------------------------------------

  describe('getProfile()', () => {
    it('should return user profile for valid userId', async () => {
      const profile = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(mockUser.id);

      expect(result).toEqual(profile);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException for non-existent userId', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});