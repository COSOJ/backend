import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../schema/User';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
