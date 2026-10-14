import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

describe('UsersController', () => {
  let controller: UsersController;

  const usersService = {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    findAllCustomers: jest.fn(),
    getCustomerDetail: jest.fn(),
    toggleCustomerStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates profile lookup to UsersService', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-uuid' });

    await controller.getMe({ sub: 'user-uuid' } as JwtPayload);

    expect(usersService.findById).toHaveBeenCalledWith('user-uuid');
  });
});