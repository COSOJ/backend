import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * Optional JWT Auth Guard - allows requests with or without authentication
 * Populates req.user if token is present and valid, otherwise leaves it undefined
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Override canActivate to always return true (allowing unauthenticated access)
   * but still attempt authentication if token is present
   */
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  /**
   * Override handleRequest to not throw errors for missing/invalid tokens
   * Returns user if authentication succeeds, undefined otherwise
   */
  handleRequest<TUser = Request['user']>(
    _err: unknown,
    user: Request['user'],
    // _info: unknown,
    // _context: ExecutionContext,
    // _status?: unknown,
  ): TUser {
    // Don't throw error for missing or invalid tokens
    // Just return undefined user for unauthenticated requests
    return user as TUser;
  }
}
