import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Metadata key for no-cache decorator
export const NO_CACHE_KEY = 'no_cache';

/**
 * Decorator to disable caching for specific routes
 * Useful when you want to force fresh responses for certain endpoints
 */
export const NoCache = () => SetMetadata(NO_CACHE_KEY, true);

/**
 * Interceptor that applies no-cache headers to responses
 * Prevents 304 responses by setting appropriate cache-control headers
 */
@Injectable()
export class NoCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();

    // Apply no-cache headers
    response.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    response.set('Pragma', 'no-cache');
    response.set('Expires', '0');
    response.set('Surrogate-Control', 'no-store');

    return next.handle().pipe(
      tap(() => {
        // Ensure headers are set after response processing
        response.set('Last-Modified', new Date().toUTCString());
      }),
    );
  }
}

/**
 * Composite decorator that applies both the metadata and interceptor
 * Use this on controllers or individual routes that should never be cached
 *
 * @example
 * @DisableCache()
 * @Get('problems')
 * async findAll() { ... }
 */
export const DisableCache = () =>
  applyDecorators(NoCache(), UseInterceptors(NoCacheInterceptor));
