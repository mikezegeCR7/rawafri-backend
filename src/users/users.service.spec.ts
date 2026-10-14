import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    id: 'user-uuid',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    phone: '08012345678',
    firstName: 'John',
    lastName: 'Doe',
    role: Role.CUSTOMER,
    refreshToken: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-value');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    const dto: CreateUserDto = {
      email: 'test@example.com',
      password: 'Password1!',
      phone: '08012345678',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('creates a user without sensitive fields in the response', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.createUser(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('refreshToken');
      expect(result.email).toBe(mockUser.email);
    });

    it('throws ConflictException when email exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);

      await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('returns a safe user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(mockUser.id);
    });

    it('throws NotFoundException when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateRefreshToken', () => {
    it('hashes and stores the refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: mockUser.id });
      prisma.user.update.mockResolvedValue(mockUser);

      await service.updateRefreshToken(mockUser.id, 'refresh-token');

      expect(bcrypt.hash).toHaveBeenCalledWith('refresh-token', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshToken: 'hashed-value' },
      });
    });

    it('throws BadRequestException for empty refresh token', async () => {
      await expect(
        service.updateRefreshToken(mockUser.id, '  '),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeRefreshToken', () => {
    it('clears the stored refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: mockUser.id });
      prisma.user.update.mockResolvedValue({ ...mockUser, refreshToken: null });

      await service.removeRefreshToken(mockUser.id);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshToken: null },
      });
    });
  });
});
