import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:3002',
    'http://localhost:3001',
    'https://ecommerce-admin-production-7e7b.up.railway.app',
    // Add storefront URL here once deployed
  ]

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true)
      if (allowedOrigins.some(o => origin.startsWith(o.replace('https://', '').replace('http://', '')))) {
        return callback(null, true)
      }
      // Also allow any railway.app subdomain for flexibility
      if (origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) {
        return callback(null, true)
      }
      if (origin.endsWith('.vercel.app')) {
        return callback(null, true)
      }
      callback(new Error('Not allowed by CORS'))
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Shbash E-Commerce API')
    .setDescription('API endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 3000);
  console.log(`🚀 Server running on port ${process.env.PORT || 3000}`);
}
bootstrap();