import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import cookieParser from 'cookie-parser'; //

const server = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Track initialization using a Promise to prevent race conditions on Vercel cold starts
let appPromise: Promise<void> | null = null;

const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'DATABASE_URL',
  'ADMIN_URL',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_CALLBACK_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
] as const;

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[Startup] Missing required environment variables: ${missing.join(', ')}. ` +
      'The application cannot start safely without these values.',
    );
  }

  // Validate FRONTEND_URL is a known safe origin to prevent redirect abuse
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl && process.env.NODE_ENV === 'production') {
    const allowed = allowedOrigins;
    if (allowed.length > 0 && !allowed.some(o => frontendUrl.startsWith(o))) {
      throw new Error(
        `[Startup] FRONTEND_URL "${frontendUrl}" is not in ALLOWED_ORIGINS. ` +
        'Add it to ALLOWED_ORIGINS or update FRONTEND_URL.',
      );
    }
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
  );

  app.setGlobalPrefix('api');

  // REGISTER COOKIE PARSER: Required for JwtStrategy to read HttpOnly cookies
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // SECURE CORS: Remove the "null origin" leak for production
  app.enableCors({
    origin: (requestOrigin, callback) => {
      const isDev = process.env.NODE_ENV !== 'production';

      // Only allow requests with no origin (like Postman/Server-side) in Development
      if (!requestOrigin) return callback(null, isDev);

      if (allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${requestOrigin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"], // Added Cookie to headers
  });

  // SWAGGER: Only expose documentation in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Shbash E-Commerce API')
      .setDescription('The official backend for Shbash')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
      customSiteTitle: 'Shbash API Docs',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
      ],
      customCssUrl: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      ],
    });
  }

  await app.init();
}

function setupNestApp() {
  if (!appPromise) {
    appPromise = bootstrap();
  }
  return appPromise;
}

// THE VERCEL HANDLER
export default async (req: any, res: any) => {
  await setupNestApp();
  return server(req, res);
};