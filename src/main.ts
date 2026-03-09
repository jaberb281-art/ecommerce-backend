import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — locked to specific origins in production via environment variable.
  // Set ALLOWED_ORIGIN=https://yourfrontend.com in your .env for production.
  // Falls back to all origins in development.
  app.enableCors({
    origin: ['http://localhost:3002', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
    credentials: true,
  });

  // Global validation pipe:
  // - whitelist: strips any fields not in the DTO silently
  // - forbidNonWhitelisted: throws 400 if unknown fields are sent
  // - transform: enables @Transform decorators and auto type coercion
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Tesla E-Commerce API')
    .setDescription('Test API endpoints here')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('🚀 Server running at http://localhost:3000');
  console.log('📖 Swagger docs at http://localhost:3000/api');
}
bootstrap();