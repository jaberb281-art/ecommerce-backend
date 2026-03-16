import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API prefix
  app.setGlobalPrefix('api');

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://ecommerce-admin-production-7e7b.up.railway.app',
    'https://ecommerce-storefront-production.up.railway.app',
    'https://ecommerce-backend-production-44ff.up.railway.app',
  ];

  // Enable CORS
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`), false);
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-idempotency-key',
    ],
    credentials: true,
  });

  // Global validation
  app.enableCors({
    origin: true,
    credentials: true,
  });
  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Shbash E-Commerce API')
    .setDescription('API endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Railway requires PORT
  const port = process.env.PORT || 8080;

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Server running on port ${port}`);
  console.log(`📚 Swagger Docs available at /api/docs`);
}

bootstrap();