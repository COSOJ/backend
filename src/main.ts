import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // todo: use config file to handle our sites only
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
