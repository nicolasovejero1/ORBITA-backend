import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync } from 'fs';
import { join } from 'path';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { parseCorsOrigins } from './common/utils/cors.utils';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás de un reverse proxy (Caddy en el VPS) todas las requests llegan
  // desde 127.0.0.1: sin esto el ThrottlerGuard cuenta a todos los usuarios
  // como una sola IP y el límite de THROTTLE_LIMIT pasa a ser global.
  // TRUST_PROXY = cantidad de proxies delante (1 con Caddy); sin definir en local.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY));
  }

  // Los archivos de los reportes ya no se sirven como estáticos: se entregan
  // con un enlace firmado (GET /reportes/adjuntos/archivo), solo a quien puede
  // ver el reporte.
  mkdirSync(join(process.cwd(), 'uploads'), { recursive: true });

  // Las respuestas de la API son JSON con datos por-usuario (autorización vía
  // Bearer token). Express les asigna un ETag por default, y el navegador
  // cachea por URL sin considerar el header Authorization: dos usuarios
  // distintos pidiendo la misma URL pueden recibir un 304 con el cuerpo
  // cacheado de OTRO usuario.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use(helmet({ contentSecurityPolicy: false }));

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle(
      'Sistema de gestión, monitoreo y seguimiento a personas con discapacidad',
    )
    .setDescription(
      [
        'API REST para la gestión de personas con discapacidad (PCD), sus tutores y profesionales a cargo.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // HOST=127.0.0.1 en el VPS para que Node solo sea accesible a través del
  // proxy; sin definir, escucha en todas las interfaces (default de Nest).
  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST;
  await (host ? app.listen(port, host) : app.listen(port));
}

void bootstrap();
