import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  const registerDto: RegisterDto = {
    email: 'test@example.com',
    password: 'Password1!',
    phone: '08012345678',
    firstName: 'John',
    lastName: 'Doe',
  };

  const loginDto: LoginDto = {
    email: 'test@example.com',
    password: 'Password1!',
  };

  const authResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      id: 'user-uuid',
      email: registerDto.email,
      phone: registerDto.phone,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: Role.CUSTOMER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates registration to AuthService', async () => {
    authService.register.mockResolvedValue(authResponse);

    await expect(controller.register(registerDto)).resolves.toEqual(
      authResponse,
    );
    expect(authService.register).toHaveBeenCalledWith(registerDto);
  });

  it('delegates login to AuthService', async () => {
    authService.login.mockResolvedValue(authResponse);

    await expect(controller.login(loginDto)).resolves.toEqual(authResponse);
    expect(authService.login).toHaveBeenCalledWith(loginDto);
  });

  it('uses HttpStatus.CREATED for register route metadata', () => {
    const metadata = Reflect.getMetadata(
      '__httpCode__',
      AuthController.prototype.register,
    );

    expect(metadata).toBe(HttpStatus.CREATED);
  });

  it('uses HttpStatus.OK for login route metadata', () => {
    const metadata = Reflect.getMetadata(
      '__httpCode__',
      AuthController.prototype.login,
    );

    expect(metadata).toBe(HttpStatus.OK);
  });
});
