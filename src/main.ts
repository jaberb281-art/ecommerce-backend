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

  // Simplified CORS for testing deployment
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Shbash E-Commerce API')
    .setDescription('API endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // FIX: Map Swagger to 'docs' so it lives at /api/docs
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    customSiteTitle: 'Shbash API Docs',
  });

  await app.init();
};

// Start logic
if (process.env.NODE_ENV !== 'production') {
  bootstrap().then(() => {
    const port = process.env.PORT || 8080;
    server.listen(port, () => console.log(`🚀 Local server on port ${port}`));
  });
}

export default server;