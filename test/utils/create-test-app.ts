import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

/**
 * Bootstrapea la app igual que `src/main.ts` (mismo `ValidationPipe` y
 * `AllExceptionsFilter` globales), pero sin abrir el puerto HTTP real — para
 * usar con supertest, que le pega directo al servidor HTTP interno de Nest.
 *
 * `overrides` reemplaza providers (p. ej. el envío de correo) por dobles de prueba.
 */
export async function createTestApp(
  overrides: { provide: unknown; useValue: unknown }[] = [],
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const o of overrides) {
    builder = builder.overrideProvider(o.provide).useValue(o.useValue);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}
