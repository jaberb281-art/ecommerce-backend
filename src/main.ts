import express from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';

const server = express();

export const bootstrap = async () => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
  );

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://ecommerce-storefront-g9rn.vercel.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Shbash E-Commerce API')
    .setDescription('API endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // FIX: Setting the path to 'docs' while useGlobalPrefix is true 
  // results in the correct /api/docs path.
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });

  await app.init();
  return server; // Explicitly return the instance
};

// Local vs Vercel logic
if (process.env.NODE_ENV !== 'production') {
  bootstrap().then(() => {
    const port = process.env.PORT || 8080;
    server.listen(port, () => console.log(`🚀 Local server on port ${port}`));
  });
}

export default server;