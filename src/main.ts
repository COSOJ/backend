import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// todo: use config file to handle our sites only
const allowedOrigins = [
  'http://localhost:5173',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true, // for cookies and headers
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
