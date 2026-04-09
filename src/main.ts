import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { developmentConfig } from './config/development.config';

// todo: use config file to handle our sites only
const allowedOrigins = ['http://localhost:5173'];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Disable caching in development mode to prevent 304 responses
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (isDevelopment) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Apply development cache headers to prevent 304 responses
      Object.entries(developmentConfig.cache.headers).forEach(
        ([key, value]) => {
          res.set(key, value);
        },
      );
      next();
    });

    // Disable ETag generation at Express level
    app.set('etag', developmentConfig.etag);
  }

  // Add global validation pipe for input validation (security requirement)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true, // for cookies and headers
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
