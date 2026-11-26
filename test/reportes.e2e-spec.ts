/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call -- res.body y app.getHttpServer() de supertest no están tipados */
import { INestApplication } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'fs/promises';
import * as path from 'path';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { createTestApp } from './utils/create-test-app';
import {
  authHeader,
  crearUsuario,
  crearVinculo,
  login,
} from './utils/fixtures';
import { TipoAdjunto } from '../src/common/enums/tipo-adjunto.enum';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';
import { ReporteAdjunto } from '../src/reportes/entities/reporte-adjunto.entity';

describe('Reportes (e2e)', () => {
  let app: INestApplication;
  let profToken: string;
  let profSinVinculoToken: string;
  let profAdminToken: string;
  let pcdToken: string;
  let pcdId: number;
  let actividadId: number;
  let instanciaId: number;
  let reporteId: number;

  beforeAll(async () => {
    app = await createTestApp();

    const pcd = await crearUsuario(app, {
      email: 'reportes.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    pcdId = pcd.id;
    pcdToken = await login(app, pcd.email);

    const profesional = await crearUsuario(app, {
      email: 'reportes.prof@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
    });
    await crearVinculo(app, pcdId, profesional.id);
    profToken = await login(app, profesional.email);

    const profSinVinculo = await crearUsuario(app, {
      email: 'reportes.prof.sinvinculo@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
    });
    profSinVinculoToken = await login(app, profSinVinculo.email);

    // Profesional con permisos de administrador: lee todo, pero no gestiona
    // reportes ajenos (solo el creador, igual que en actividades).
    const profAdmin = await crearUsuario(app, {
      email: 'reportes.prof.admin@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
      esAdministrador: true,
    });
    profAdminToken = await login(app, profAdmin.email);

    const actividad = await request(app.getHttpServer())
      .post('/actividades')
      .set(...authHeader(profToken))
      .send({
        titulo: 'Actividad para reportes',
        descripcion: 'Descripción de prueba',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-03',
        tipoActividad: 'EJERCICIO',
        frecuencia: 'DIARIA',
        pcdId,
      });
    actividadId = actividad.body.id;
    instanciaId = actividad.body.instancias[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /reportes', () => {
    it('flujo feliz: el Profesional con vínculo crea un reporte', async () => {
      const res = await request(app.getHttpServer())
        .post('/reportes')
        .set(...authHeader(profToken))
        .send({
          titulo: 'Reporte E2E',
          tipo: 'DE_ACTIVIDAD',
          actividadId,
          instanciaId,
        });
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('EN_CURSO');
      reporteId = res.body.id;
    });

    it('400: título de más de 100 caracteres', async () => {
      const res = await request(app.getHttpServer())
        .post('/reportes')
        .set(...authHeader(profToken))
        .send({ titulo: 'a'.repeat(101), tipo: 'MENSUAL', actividadId });
      expect(res.status).toBe(400);
    });

    it('400: la instancia no pertenece a la actividad indicada', async () => {
      const res = await request(app.getHttpServer())
        .post('/reportes')
        .set(...authHeader(profToken))
        .send({
          titulo: 'Reporte con instancia inválida',
          tipo: 'DE_ACTIVIDAD',
          actividadId,
          instanciaId: 999999,
        });
      expect(res.status).toBe(400);
    });

    it('401: sin token', async () => {
      const res = await request(app.getHttpServer()).post('/reportes').send({});
      expect(res.status).toBe(401);
    });

    it('403: Profesional sin vínculo activo con el PCD de la actividad', async () => {
      const res = await request(app.getHttpServer())
        .post('/reportes')
        .set(...authHeader(profSinVinculoToken))
        .send({ titulo: 'Sin vínculo', tipo: 'DE_ACTIVIDAD', actividadId });
      expect(res.status).toBe(403);
    });

    it('404: actividad inexistente', async () => {
      const res = await request(app.getHttpServer())
        .post('/reportes')
        .set(...authHeader(profToken))
        .send({ titulo: 'XX', tipo: 'DE_ACTIVIDAD', actividadId: 999999 });
      expect(res.status).toBe(404);
    });

    it('409: ya existe un reporte de este profesional para esa instancia', async () => {
      const res = await request(app.getHttpServer())
        .post('/reportes')
        .set(...authHeader(profToken))
        .send({
          titulo: 'Duplicado',
          tipo: 'DE_ACTIVIDAD',
          actividadId,
          instanciaId,
        });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /reportes/:id/adjuntos', () => {
    it('flujo feliz: registra un enlace y queda siempre como URL', async () => {
      const res = await request(app.getHttpServer())
        .post(`/reportes/${reporteId}/adjuntos`)
        .set(...authHeader(profToken))
        .send({ filePath: 'https://ejemplo.com/informe.pdf' });
      expect(res.status).toBe(201);
      expect(res.body.tipoArchivo).toBe('URL');
    });

    it('400: rechaza una ruta local (no se puede apuntar a archivos subidos)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/reportes/${reporteId}/adjuntos`)
        .set(...authHeader(profToken))
        .send({ filePath: '/uploads/reportes/x.png' });
      expect(res.status).toBe(400);
    });

    it('400: rechaza un enlace que no es http(s)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/reportes/${reporteId}/adjuntos`)
        .set(...authHeader(profToken))
        .send({ filePath: 'javascript:alert(1)' });
      expect(res.status).toBe(400);
    });

    it('403: otro Profesional (no creador) no puede agregar adjuntos', async () => {
      await crearVinculo(
        app,
        pcdId,
        (
          await crearUsuario(app, {
            email: 'reportes.prof2@e2e.com',
            tipoUsuario: TipoUsuario.PROFESIONAL,
          })
        ).id,
      );
      const otroToken = await login(app, 'reportes.prof2@e2e.com');

      const res = await request(app.getHttpServer())
        .post(`/reportes/${reporteId}/adjuntos`)
        .set(...authHeader(otroToken))
        .send({ filePath: 'https://ejemplo.com/y.png' });
      expect(res.status).toBe(403);
    });
  });

  describe('Adjuntos con enlace firmado', () => {
    const PNG_1X1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
      'base64',
    );
    let adjReporteId: number;
    let adjuntoId: number;
    let archivoPath: string;

    beforeAll(async () => {
      const creado = await request(app.getHttpServer())
        .post('/reportes')
        .set(...authHeader(profToken))
        .send({ titulo: 'Con archivo', tipo: 'MENSUAL', actividadId });
      adjReporteId = creado.body.id;

      // Se deja el archivo en disco y se registra por ruta: la validación por
      // contenido del upload usa un módulo ESM que Jest (CommonJS) no carga.
      archivoPath = `/uploads/reportes/e2e-${Date.now()}.png`;
      await mkdir(path.join(process.cwd(), 'uploads', 'reportes'), {
        recursive: true,
      });
      await writeFile(path.join(process.cwd(), archivoPath), PNG_1X1);
      const adjuntoRepo: Repository<ReporteAdjunto> = app.get(
        getRepositoryToken(ReporteAdjunto),
      );
      const subido = await adjuntoRepo.save(
        adjuntoRepo.create({
          reporteId: adjReporteId,
          tipoArchivo: TipoAdjunto.IMAGEN,
          filePath: archivoPath,
        }),
      );
      adjuntoId = subido.id;
    });

    afterAll(async () => {
      await rm(path.join(process.cwd(), archivoPath), { force: true });
    });

    it('el archivo ya no se sirve como estático', async () => {
      const res = await request(app.getHttpServer()).get(archivoPath);
      expect(res.status).toBe(404);
    });

    it('el creador obtiene un enlace y con él descarga el archivo sin sesión', async () => {
      const enlace = await request(app.getHttpServer())
        .get(`/reportes/${adjReporteId}/adjuntos/${adjuntoId}/url`)
        .set(...authHeader(profToken));
      expect(enlace.status).toBe(200);
      expect(enlace.body.externo).toBe(false);
      expect(enlace.body.expiraEnSegundos).toBe(60);

      const archivo = await request(app.getHttpServer()).get(enlace.body.url);
      expect(archivo.status).toBe(200);
      expect(archivo.headers['content-type']).toContain('image/png');
    });

    it('403: quien no puede ver el reporte no recibe el enlace', async () => {
      for (const token of [pcdToken, profSinVinculoToken]) {
        const res = await request(app.getHttpServer())
          .get(`/reportes/${adjReporteId}/adjuntos/${adjuntoId}/url`)
          .set(...authHeader(token));
        expect(res.status).toBe(403);
      }
    });

    it('401: sin sesión no se pide el enlace, y sin token o con uno inválido no se descarga', async () => {
      const sinSesion = await request(app.getHttpServer()).get(
        `/reportes/${adjReporteId}/adjuntos/${adjuntoId}/url`,
      );
      expect(sinSesion.status).toBe(401);

      const sinToken = await request(app.getHttpServer()).get(
        '/reportes/adjuntos/archivo',
      );
      expect(sinToken.status).toBe(401);

      const invalido = await request(app.getHttpServer()).get(
        '/reportes/adjuntos/archivo?token=cualquiera',
      );
      expect(invalido.status).toBe(401);
    });

    it('un enlace externo se devuelve tal cual', async () => {
      const ext = await request(app.getHttpServer())
        .post(`/reportes/${adjReporteId}/adjuntos`)
        .set(...authHeader(profToken))
        .send({ filePath: 'https://ejemplo.com/a.pdf' });
      const res = await request(app.getHttpServer())
        .get(`/reportes/${adjReporteId}/adjuntos/${ext.body.id}/url`)
        .set(...authHeader(profToken));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        url: 'https://ejemplo.com/a.pdf',
        externo: true,
        expiraEnSegundos: null,
      });
    });
  });

  describe('PATCH /reportes/:id/estado', () => {
    it('400: el único cambio posible es FINALIZADO', async () => {
      for (const estado of ['EN_CURSO', 'INICIADO']) {
        const res = await request(app.getHttpServer())
          .patch(`/reportes/${reporteId}/estado`)
          .set(...authHeader(profToken))
          .send({ estado });
        expect(res.status).toBe(400);
      }
    });

    it('403: un Profesional con permisos de administrador que no es el creador', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/estado`)
        .set(...authHeader(profAdminToken))
        .send({ estado: 'FINALIZADO' });
      expect(res.status).toBe(403);
    });

    it('flujo feliz: FINALIZADO', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}/estado`)
        .set(...authHeader(profToken))
        .send({ estado: 'FINALIZADO' });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('FINALIZADO');
    });

    it('409: un reporte FINALIZADO no puede modificarse', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/reportes/${reporteId}`)
        .set(...authHeader(profToken))
        .send({ titulo: 'Ya no debería poder' });
      expect(res.status).toBe(409);
    });
  });

  describe('Visibilidad para el PCD', () => {
    let visibleId: number;

    it('el PCD no ve un reporte EN_CURSO ni uno FINALIZADO sin visibilidad', async () => {
      // reporteId ya está FINALIZADO, pero sin visibilidadTutor.
      const detalle = await request(app.getHttpServer())
        .get(`/reportes/${reporteId}`)
        .set(...authHeader(pcdToken));
      expect(detalle.status).toBe(403);

      const creado = await request(app.getHttpServer())
        .post('/reportes')
        .set(...authHeader(profToken))
        .send({ titulo: 'Reporte visible', tipo: 'MENSUAL', actividadId });
      visibleId = creado.body.id;

      const enCurso = await request(app.getHttpServer())
        .get(`/reportes/${visibleId}`)
        .set(...authHeader(pcdToken));
      expect(enCurso.status).toBe(403);

      const lista = await request(app.getHttpServer())
        .get('/reportes')
        .set(...authHeader(pcdToken));
      expect(lista.status).toBe(200);
      expect(lista.body).toHaveLength(0);
    });

    it('el PCD ve el reporte una vez FINALIZADO y visible', async () => {
      await request(app.getHttpServer())
        .patch(`/reportes/${visibleId}/estado`)
        .set(...authHeader(profToken))
        .send({ estado: 'FINALIZADO', visibilidadTutor: true })
        .expect(200);

      const lista = await request(app.getHttpServer())
        .get('/reportes')
        .set(...authHeader(pcdToken));
      expect(lista.body.map((r: { id: number }) => r.id)).toEqual([visibleId]);

      const detalle = await request(app.getHttpServer())
        .get(`/reportes/${visibleId}`)
        .set(...authHeader(pcdToken));
      expect(detalle.status).toBe(200);
    });
  });

  describe('DELETE /reportes/:id', () => {
    it('409: un reporte FINALIZADO no puede eliminarse', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/reportes/${reporteId}`)
        .set(...authHeader(profToken));
      expect(res.status).toBe(409);
    });

    it('404: reporte inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/reportes/999999')
        .set(...authHeader(profToken));
      expect(res.status).toBe(404);
    });
  });
});
