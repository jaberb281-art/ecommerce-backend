import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common'; // Add this too for later!

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ ADD THIS LINE to fix the "Failed to fetch" error
  app.enableCors();

  // ✅ ADD THIS LINE to make sure your DTO data is validated
  app.useGlobalPipes(new ValidationPipe());

  // --- Swagger Setup ---
  const config = new DocumentBuilder()
    .setTitle('E-commerce API')
    .setDescription('Test my API endpoints here')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('🚀 Server running at http://localhost:3000');
  console.log('📖 Test your API at http://localhost:3000/api');
}
bootstrap();