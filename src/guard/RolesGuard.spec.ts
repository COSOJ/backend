import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RolesGuard } from './RolesGuard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createContext = (user?: Request['user']): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user } as Request),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(createContext());

    expect(result).toBe(true);
  });

  it('should deny access when roles are required but user has no roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    const result = guard.canActivate(createContext({ userId: 'u1' }));

    expect(result).toBe(false);
  });

  it('should allow access when user has at least one required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'superadmin']);

    const result = guard.canActivate(
      createContext({ userId: 'u1', roles: ['user', 'admin'] }),
    );

    expect(result).toBe(true);
  });

  it('should deny access when user roles do not match required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['superadmin']);

    const result = guard.canActivate(
      createContext({ userId: 'u1', roles: ['user', 'admin'] }),
    );

    expect(result).toBe(false);
  });
});
