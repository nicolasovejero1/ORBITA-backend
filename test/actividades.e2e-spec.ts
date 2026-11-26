/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call -- res.body y app.getHttpServer() de supertest no están tipados */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import {
  authHeader,
  crearTutorPcd,
  crearUsuario,
  crearVinculo,
  login,
} from './utils/fixtures';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';

describe('Actividades (e2e)', () => {
  let app: INestApplication;
  let profToken: string;
  let profSinVinculoToken: string;
  let pcdId: number;
  let actividadId: number;
  let instanciaId: number;

  beforeAll(async () => {
    app = await createTestApp();

    const pcd = await crearUsuario(app, {
      email: 'actividades.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    pcdId = pcd.id;

    const profesional = await crearUsuario(app, {
      email: 'actividades.prof@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
    });
    await crearVinculo(app, pcdId, profesional.id);
    profToken = await login(app, profesional.email);

    const profSinVinculo = await crearUsuario(app, {
      email: 'actividades.prof.sinvinculo@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
    });
    profSinVinculoToken = await login(app, profSinVinculo.email);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /actividades', () => {
    it('flujo feliz: Profesional con vínculo activo crea una actividad EJERCICIO', async () => {
      const res = await request(app.getHttpServer())
        .post('/actividades')
        .set(...authHeader(profToken))
        .send({
          titulo: 'Ejercicios E2E',
          descripcion: 'Serie de ejercicios',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-01-10',
          horarioInicio: '09:00',
          tipoActividad: 'EJERCICIO',
          frecuencia: 'DIARIA',
          pcdId,
        });
      expect(res.status).toBe(201);
      expect(res.body.instancias.length).toBe(10);
      actividadId = res.body.id;
      instanciaId = res.body.instancias[0].id;
    });

    it('400: fechaFin anterior a fechaInicio', async () => {
      const res = await request(app.getHttpServer())
        .post('/actividades')
        .set(...authHeader(profToken))
        .send({
          titulo: 'Actividad inválida',
          descripcion: 'Descripción de prueba',
          fechaInicio: '2026-01-10',
          fechaFin: '2026-01-01',
          tipoActividad: 'EJERCICIO',
          frecuencia: 'DIARIA',
          pcdId,
        });
      expect(res.status).toBe(400);
    });

    it('401: sin token', async () => {
      const res = await request(app.getHttpServer())
        .post('/actividades')
        .send({});
      expect(res.status).toBe(401);
    });

    it('403: Profesional sin vínculo activo con el PCD', async () => {
      const res = await request(app.getHttpServer())
        .post('/actividades')
        .set(...authHeader(profSinVinculoToken))
        .send({
          titulo: 'Sin vínculo',
          descripcion: 'Descripción de prueba',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-01-05',
          tipoActividad: 'EJERCICIO',
          frecuencia: 'DIARIA',
          pcdId,
        });
      expect(res.status).toBe(403);
    });

    it('403: un Tutor no puede crear actividades de tipo TERAPIA', async () => {
      const tutor = await crearUsuario(app, {
        email: 'actividades.tutor@e2e.com',
        tipoUsuario: TipoUsuario.TUTOR,
      });
      await crearTutorPcd(app, tutor.id, pcdId);
      const tutorToken = await login(app, tutor.email);

      const res = await request(app.getHttpServer())
        .post('/actividades')
        .set(...authHeader(tutorToken))
        .send({
          titulo: 'Terapia por tutor',
          descripcion: 'Descripción de prueba',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-01-05',
          tipoActividad: 'TERAPIA',
          frecuencia: 'DIARIA',
          terapiaId: 1,
          pcdId,
        });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /actividades/:id', () => {
    it('flujo feliz', async () => {
      const res = await request(app.getHttpServer())
        .get(`/actividades/${actividadId}`)
        .set(...authHeader(profToken));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(actividadId);
    });

    it('404: actividad inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/actividades/999999')
        .set(...authHeader(profToken));
      expect(res.status).toBe(404);
    });

    it('403: Profesional sin vínculo no puede ver la actividad', async () => {
      const res = await request(app.getHttpServer())
        .get(`/actividades/${actividadId}`)
        .set(...authHeader(profSinVinculoToken));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /actividades (filtro por estado y orden)', () => {
    const crear = (titulo: string, horarioInicio?: string) =>
      request(app.getHttpServer())
        .post('/actividades')
        .set(...authHeader(profToken))
        .send({
          titulo,
          descripcion: 'Para probar el orden',
          fechaInicio: '2026-02-01',
          fechaFin: '2026-02-03',
          tipoActividad: 'EJERCICIO',
          frecuencia: 'DIARIA',
          pcdId,
          ...(horarioInicio && { horarioInicio }),
        });
    const titulos = (body: { titulo: string }[]) =>
      body.map((a) => a.titulo).filter((t) => t.startsWith('Orden '));

    beforeAll(async () => {
      await crear('Orden tarde', '15:00');
      await crear('Orden sin horario');
      await crear('Orden mañana', '07:30');
    });

    it('por defecto, las más nuevas primero', async () => {
      const res = await request(app.getHttpServer())
        .get('/actividades')
        .set(...authHeader(profToken));
      expect(res.status).toBe(200);
      expect(titulos(res.body)).toEqual([
        'Orden mañana',
        'Orden sin horario',
        'Orden tarde',
      ]);
    });

    it('orden=horario: por horario de inicio y las sin horario al final', async () => {
      const res = await request(app.getHttpServer())
        .get('/actividades?orden=horario')
        .set(...authHeader(profToken));
      expect(res.status).toBe(200);
      expect(titulos(res.body)).toEqual([
        'Orden mañana',
        'Orden tarde',
        'Orden sin horario',
      ]);
    });

    it('estado: filtra pendientes y completadas', async () => {
      const pendientes = await request(app.getHttpServer())
        .get('/actividades?estado=PENDIENTE')
        .set(...authHeader(profToken));
      expect(pendientes.status).toBe(200);
      expect(pendientes.body.length).toBeGreaterThan(0);
      expect(
        pendientes.body.every(
          (a: { estado: string }) => a.estado === 'PENDIENTE',
        ),
      ).toBe(true);

      const completadas = await request(app.getHttpServer())
        .get('/actividades?estado=COMPLETADA')
        .set(...authHeader(profToken));
      expect(completadas.status).toBe(200);
      expect(completadas.body).toHaveLength(0);
    });

    it('400: estado u orden inválidos', async () => {
      for (const query of ['estado=CANCELADA', 'orden=alfabetico']) {
        const res = await request(app.getHttpServer())
          .get(`/actividades?${query}`)
          .set(...authHeader(profToken));
        expect(res.status).toBe(400);
      }
    });
  });

  describe('PUT /actividades/:id', () => {
    it('flujo feliz: el creador modifica el título', async () => {
      const res = await request(app.getHttpServer())
        .put(`/actividades/${actividadId}`)
        .set(...authHeader(profToken))
        .send({ titulo: 'Ejercicios E2E (editado)' });
      expect(res.status).toBe(200);
      expect(res.body.titulo).toBe('Ejercicios E2E (editado)');
    });

    it('recordarAntesMinutos: null desactiva el recordatorio', async () => {
      await request(app.getHttpServer())
        .put(`/actividades/${actividadId}`)
        .set(...authHeader(profToken))
        .send({ recordarAntesMinutos: 15 })
        .expect(200);
      const res = await request(app.getHttpServer())
        .put(`/actividades/${actividadId}`)
        .set(...authHeader(profToken))
        .send({ recordarAntesMinutos: null });
      expect(res.status).toBe(200);
      expect(res.body.recordarAntesMinutos).toBeNull();
    });

    it('403: otro Profesional (no creador, no Admin) no puede modificar', async () => {
      const res = await request(app.getHttpServer())
        .put(`/actividades/${actividadId}`)
        .set(...authHeader(profSinVinculoToken))
        .send({ titulo: 'Hackeado' });
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /actividades/:actividadId/instancias/:instanciaId/confirmar', () => {
    it('flujo feliz: confirma la instancia pendiente', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/actividades/${actividadId}/instancias/${instanciaId}/confirmar`,
        )
        .set(...authHeader(profToken));
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('REALIZADA');
    });

    it('400: ya fue confirmada', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/actividades/${actividadId}/instancias/${instanciaId}/confirmar`,
        )
        .set(...authHeader(profToken));
      expect(res.status).toBe(400);
    });

    it('404: instancia inexistente', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/actividades/${actividadId}/instancias/999999/confirmar`)
        .set(...authHeader(profToken));
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /actividades/:id', () => {
    it('403: no creador ni Admin', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/actividades/${actividadId}`)
        .set(...authHeader(profSinVinculoToken));
      expect(res.status).toBe(403);
    });

    it('flujo feliz: el creador elimina la actividad', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/actividades/${actividadId}`)
        .set(...authHeader(profToken));
      expect(res.status).toBe(200);
    });

    it('404: ya eliminada', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/actividades/${actividadId}`)
        .set(...authHeader(profToken));
      expect(res.status).toBe(404);
    });
  });
});
