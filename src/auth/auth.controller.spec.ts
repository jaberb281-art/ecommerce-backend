import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// ---------------------------------------------------------------------------
// Mock AuthService — we test the controller in isolation, not the service
// ---------------------------------------------------------------------------

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  getProfile: jest.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  createdAt: new Date(),
};

const mockAuthResponse = {
  access_token: 'mock.jwt.token',
  user: { id: mockUser.id, email: mockUser.email, name: mockUser.name, role: mockUser.role },
};

const mockRequest = (userId: string) => ({
  user: { sub: userId, email: mockUser.email, role: mockUser.role },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);

    // Reset all mocks before each test to prevent bleed between tests
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // REGISTER
  // -------------------------------------------------------------------------

  describe('register()', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test User',
    };

    it('should register a new user and return user data without password', async () => {
      mockAuthService.register.mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw ConflictException if email already exists', async () => {
      mockAuthService.register.mockRejectedValue(
        new ConflictException({ code: 'EMAIL_ALREADY_EXISTS' }),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------------------------

  describe('login()', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should return an access token and user on valid credentials', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException({ code: 'INVALID_CREDENTIALS' }),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET PROFILE
  // -------------------------------------------------------------------------

  describe('getProfile()', () => {
    it('should return the current user profile', async () => {
      mockAuthService.getProfile.mockResolvedValue(mockUser);

      const req = mockRequest(mockUser.id) as any;
      const result = await controller.getProfile(req);

      expect(mockAuthService.getProfile).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should use req.user.sub as the userId', async () => {
      mockAuthService.getProfile.mockResolvedValue(mockUser);

      const req = mockRequest('specific-user-id') as any;
      await controller.getProfile(req);

      expect(mockAuthService.getProfile).toHaveBeenCalledWith('specific-user-id');
    });
  });
});