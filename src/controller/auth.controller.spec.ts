import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from '../service/auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
    isHandleAvailable: jest.fn(),
  };

  const createResponse = (): Response => {
    return {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(mockAuthService as unknown as AuthService);
  });

  it('should register user and set auth cookies', async () => {
    const dto = {
      handle: 'h1',
      email: 'test@example.com',
      password: 'secret123',
    };
    const res = createResponse();
    const payload = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { _id: 'u1', handle: 'h1' },
    };
    mockAuthService.register.mockResolvedValue(payload);

    const result = await controller.register(dto, res);

    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    expect((res.cookie as jest.Mock).mock.calls).toHaveLength(2);
    expect(result).toEqual({
      accessToken: payload.accessToken,
      user: payload.user,
    });
  });

  it('should login user and set auth cookies', async () => {
    const dto = {
      email: 'test@example.com',
      password: 'secret123',
    };
    const res = createResponse();
    const payload = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { _id: 'u1', handle: 'h1' },
    };
    mockAuthService.login.mockResolvedValue(payload);

    const result = await controller.login(dto, res);

    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    expect((res.cookie as jest.Mock).mock.calls).toHaveLength(2);
    expect(result).toEqual({
      accessToken: payload.accessToken,
      user: payload.user,
    });
  });

  it('should refresh tokens and set new cookies', async () => {
    const res = createResponse();
    const req = {
      user: { userId: 'u1' },
      cookies: { refreshToken: 'old-token' },
    } as Request & { cookies: { refreshToken?: string } };

    mockAuthService.refreshTokens.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    const result = await controller.refresh(req, res);

    expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('u1');
    expect((res.cookie as jest.Mock).mock.calls).toHaveLength(2);
    expect(result).toEqual({ accessToken: 'new-access' });
  });

  it('should throw when refresh request is missing user id', async () => {
    const res = createResponse();
    const req = {
      user: undefined,
      cookies: {},
    } as Request & { cookies: { refreshToken?: string } };

    await expect(controller.refresh(req, res)).rejects.toThrow(
      'Missing authenticated user id',
    );
  });

  it('should check handle availability', async () => {
    mockAuthService.isHandleAvailable.mockResolvedValue({ available: true });

    const result = await controller.checkHandle('new-handle');

    expect(mockAuthService.isHandleAvailable).toHaveBeenCalledWith(
      'new-handle',
    );
    expect(result).toEqual({ available: true });
  });

  it('should return current user in me', () => {
    const req = { user: { userId: 'u1', roles: ['user'] } } as Request;

    const result = controller.me(req);

    expect(result).toEqual(req.user);
  });

  it('should clear cookies on logout', () => {
    const res = createResponse();

    const result = controller.logout(res);

    expect(res.clearCookie).toHaveBeenNthCalledWith(1, 'accessToken');
    expect(res.clearCookie).toHaveBeenNthCalledWith(2, 'refreshToken');
    expect(result).toEqual({ message: 'Logged out successfully' });
  });
});
