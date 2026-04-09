import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from './OptionalJwtAuthGuard';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  it('should delegate canActivate to parent AuthGuard', () => {
    const context = {} as ExecutionContext;
    const parentPrototype = Object.getPrototypeOf(
      OptionalJwtAuthGuard.prototype,
    ) as {
      canActivate: (ctx: ExecutionContext) => boolean;
    };

    const canActivateSpy = jest
      .spyOn(parentPrototype, 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(context);

    expect(canActivateSpy).toHaveBeenCalledWith(context);
    expect(result).toBe(true);
  });

  it('should return authenticated user from handleRequest', () => {
    const user: Request['user'] = { userId: 'u1', roles: ['user'] };

    const result = guard.handleRequest(null, user);

    expect(result).toEqual(user);
  });

  it('should return undefined user for unauthenticated request', () => {
    const result = guard.handleRequest(null, undefined);

    expect(result).toBeUndefined();
  });
});
