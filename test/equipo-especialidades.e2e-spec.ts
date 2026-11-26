/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- res.body y app.getHttpServer() de supertest no están tipados */
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
import { RolProfesionalVinculo } from '../src/common/enums/rol-profesional-vinculo.enum';

/**
 * Especialidades y equipo del PCD: el cabecera asigna especialistas y lee todo
 * lo de sus pacientes; un especialista solo programa terapias de su
 * especialidad.
 */
describe('Equipo y especialidades (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let cabeceraToken: string;
  let cabeceraId: number;
  let kineToken: string;
  let kineId: number;
  let fonoToken: string;
  let fonoId: number;
  let otroCabeceraToken: string;
  let tutorToken: string;
  let pcdId: number;
  let otroPcdId: number;
  let especialidadIds: Record<string, number>;
  let terapiaKineId: number;
  let terapiaFonoId: number;
  let actividadKineId: number;
  let instanciaKineId: number;
  let reporteKineId: number;

  const get = (token: string, url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set(...authHeader(token));
  const post = (token: string, url: string, body: object) =>
    request(app.getHttpServer())
      .post(url)
      .set(...authHeader(token))
      .send(body);

  const actividadBase = (terapiaId: number, pcd: number) => ({
    titulo: 'Sesión',
    descripcion: 'Terapia de prueba',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-01-03',
    tipoActividad: 'TERAPIA',
    frecuencia: 'DIARIA',
    terapiaId,
    pcdId: pcd,
  });

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await crearUsuario(app, {
      email: 'equipo.admin@e2e.com',
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
      esAdministrador: true,
    });
    adminToken = await login(app, admin.email);

    const pcd = await crearUsuario(app, {
      email: 'equipo.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    pcdId = pcd.id;
    const otroPcd = await crearUsuario(app, {
      email: 'equipo.otropcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    otroPcdId = otroPcd.id;

    const cabecera = await crearUsuario(app, {
      email: 'equipo.cabecera@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
      especialidad: 'Medicina General',
    });
    cabeceraId = cabecera.id;
    await crearVinculo(app, pcdId, cabecera.id, RolProfesionalVinculo.CABECERA);
    cabeceraToken = await login(app, cabecera.email);

    const kine = await crearUsuario(app, {
      email: 'equipo.kine@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
      especialidad: 'Kinesiología',
    });
    kineId = kine.id;
    await crearVinculo(app, pcdId, kine.id, RolProfesionalVinculo.ESPECIALISTA);
    kineToken = await login(app, kine.email);

    const fono = await crearUsuario(app, {
      email: 'equipo.fono@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
      especialidad: 'Fonoaudiología',
    });
    fonoId = fono.id;
    fonoToken = await login(app, fono.email);

    // Cabecera de otro PCD: no tiene nada que ver con este equipo.
    const otroCabecera = await crearUsuario(app, {
      email: 'equipo.otrocabecera@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
      especialidad: 'Medicina General',
    });
    await crearVinculo(
      app,
      otroPcdId,
      otroCabecera.id,
      RolProfesionalVinculo.CABECERA,
    );
    otroCabeceraToken = await login(app, otroCabecera.email);

    const tutor = await crearUsuario(app, {
      email: 'equipo.tutor@e2e.com',
      tipoUsuario: TipoUsuario.TUTOR,
    });
    await crearTutorPcd(app, tutor.id, pcdId);
    tutorToken = await login(app, tutor.email);

    // El script de e2e vacía las tablas después de migrar: el catálogo base no
    // está. Kinesiología, Fonoaudiología y Medicina General las crean los
    // fixtures; Psicología se agrega acá.
    await post(adminToken, '/especialidades', { nombre: 'Psicología' });
    const lista = await get(adminToken, '/especialidades');
    especialidadIds = Object.fromEntries(
      lista.body.map((e: { id: number; nombre: string }) => [e.nombre, e.id]),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Catálogo de especialidades', () => {
    it('todos los roles listan las especialidades', async () => {
      const res = await get(tutorToken, '/especialidades');
      expect(res.status).toBe(200);
      expect(res.body.map((e: { nombre: string }) => e.nombre)).toEqual(
        expect.arrayContaining(['Kinesiología', 'Fonoaudiología']),
      );
    });

    it('solo el Administrador crea; el nombre es único (409)', async () => {
      const ok = await post(adminToken, '/especialidades', {
        nombre: 'Hipoterapia',
      });
      expect(ok.status).toBe(201);

      const duplicada = await post(adminToken, '/especialidades', {
        nombre: 'hipoterapia',
      });
      expect(duplicada.status).toBe(409);

      const prohibido = await post(kineToken, '/especialidades', {
        nombre: 'Musicoterapia',
      });
      expect(prohibido.status).toBe(403);
    });

    it('no se borra una especialidad en uso (409), y una libre sí', async () => {
      const enUso = await request(app.getHttpServer())
        .delete(`/especialidades/${especialidadIds['Kinesiología']}`)
        .set(...authHeader(adminToken));
      expect(enUso.status).toBe(409);

      const nueva = await post(adminToken, '/especialidades', {
        nombre: 'Para borrar',
      });
      const libre = await request(app.getHttpServer())
        .delete(`/especialidades/${nueva.body.id}`)
        .set(...authHeader(adminToken));
      expect(libre.status).toBe(200);
    });

    it('un Profesional se crea con especialidadId y la respuesta trae su especialidad', async () => {
      const res = await post(adminToken, '/usuarios', {
        nombre: 'Nuevo',
        apellido: 'Profesional',
        dni: '30111222',
        email: 'equipo.nuevo.prof@e2e.com',
        password: 'Test1234!',
        fechaNacimiento: '1990-01-01',
        tipoUsuario: 'PROFESIONAL',
        matricula: 'MP-E2E-1',
        especialidadId: especialidadIds['Psicología'],
      });
      expect(res.status).toBe(201);
      expect(res.body.profesional.especialidad).toEqual({
        id: especialidadIds['Psicología'],
        nombre: 'Psicología',
      });
    });

    it('400: especialidadId inexistente o faltante', async () => {
      const base = {
        nombre: 'Otro',
        apellido: 'Profesional',
        dni: '30111333',
        email: 'equipo.otro.prof@e2e.com',
        password: 'Test1234!',
        fechaNacimiento: '1990-01-01',
        tipoUsuario: 'PROFESIONAL',
        matricula: 'MP-E2E-2',
      };
      const inexistente = await post(adminToken, '/usuarios', {
        ...base,
        especialidadId: 99999,
      });
      expect(inexistente.status).toBe(400);
      const faltante = await post(adminToken, '/usuarios', base);
      expect(faltante.status).toBe(400);
    });
  });

  describe('Terapias por especialidad', () => {
    it('un Profesional crea terapias de su especialidad (la toma por defecto)', async () => {
      const res = await post(kineToken, '/terapias', {
        tipo: 'Rehabilitación E2E',
        descripcion: 'Ejercicios guiados',
      });
      expect(res.status).toBe(201);
      expect(res.body.especialidad.nombre).toBe('Kinesiología');
      terapiaKineId = res.body.id;
    });

    it('403: no crea terapias de otra especialidad', async () => {
      const res = await post(kineToken, '/terapias', {
        tipo: 'Habla E2E',
        descripcion: 'Trabajo del habla',
        especialidadId: especialidadIds['Fonoaudiología'],
      });
      expect(res.status).toBe(403);
    });

    it('el Administrador crea de cualquier especialidad y el profesional de otra no la edita', async () => {
      const res = await post(adminToken, '/terapias', {
        tipo: 'Lenguaje E2E',
        descripcion: 'Trabajo del habla',
        especialidadId: especialidadIds['Fonoaudiología'],
      });
      expect(res.status).toBe(201);
      terapiaFonoId = res.body.id;

      const edicion = await request(app.getHttpServer())
        .put(`/terapias/${terapiaFonoId}`)
        .set(...authHeader(kineToken))
        .send({ descripcion: 'cambio' });
      expect(edicion.status).toBe(403);
    });
  });

  describe('Actividades de terapia', () => {
    it('el especialista programa una terapia de su especialidad', async () => {
      const res = await post(
        kineToken,
        '/actividades',
        actividadBase(terapiaKineId, pcdId),
      );
      expect(res.status).toBe(201);
      actividadKineId = res.body.id;
      instanciaKineId = res.body.instancias[0].id;
    });

    it('403: el especialista no programa una terapia de otra especialidad', async () => {
      const res = await post(
        kineToken,
        '/actividades',
        actividadBase(terapiaFonoId, pcdId),
      );
      expect(res.status).toBe(403);
    });

    it('el cabecera programa una terapia de cualquier especialidad', async () => {
      const res = await post(
        cabeceraToken,
        '/actividades',
        actividadBase(terapiaFonoId, pcdId),
      );
      expect(res.status).toBe(201);
    });
  });

  describe('El cabecera lee todo lo de sus pacientes', () => {
    it('ve las actividades de los especialistas, pero no las de otro PCD', async () => {
      const lista = await get(cabeceraToken, '/actividades');
      expect(lista.status).toBe(200);
      expect(lista.body.map((a: { id: number }) => a.id)).toContain(
        actividadKineId,
      );

      const detalle = await get(
        cabeceraToken,
        `/actividades/${actividadKineId}`,
      );
      expect(detalle.status).toBe(200);
    });

    it('un cabecera de otro PCD no ve la actividad', async () => {
      const res = await get(
        otroCabeceraToken,
        `/actividades/${actividadKineId}`,
      );
      expect(res.status).toBe(403);
    });

    it('un especialista que no la creó no ve la actividad de otro', async () => {
      const propia = await post(
        cabeceraToken,
        '/actividades',
        actividadBase(terapiaKineId, pcdId),
      );
      expect(propia.status).toBe(201);
      await crearVinculo(
        app,
        pcdId,
        fonoId,
        RolProfesionalVinculo.ESPECIALISTA,
      );
      const res = await get(fonoToken, `/actividades/${propia.body.id}`);
      expect(res.status).toBe(403);
    });

    it('lee pero no confirma las sesiones de las actividades ajenas (403)', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/actividades/${actividadKineId}/instancias/${instanciaKineId}/confirmar`,
        )
        .set(...authHeader(cabeceraToken));
      expect(res.status).toBe(403);
    });

    it('lee los reportes de los especialistas, también los que están en curso', async () => {
      const creado = await post(kineToken, '/reportes', {
        titulo: 'Reporte del especialista',
        tipo: 'MENSUAL',
        actividadId: actividadKineId,
      });
      expect(creado.status).toBe(201);
      reporteKineId = creado.body.id;

      const lista = await get(cabeceraToken, '/reportes');
      expect(lista.body.map((r: { id: number }) => r.id)).toContain(
        reporteKineId,
      );
      const detalle = await get(cabeceraToken, `/reportes/${reporteKineId}`);
      expect(detalle.status).toBe(200);

      // Leer no es gestionar: sigue siendo del creador.
      const edicion = await request(app.getHttpServer())
        .patch(`/reportes/${reporteKineId}`)
        .set(...authHeader(cabeceraToken))
        .send({ titulo: 'cambio' });
      expect(edicion.status).toBe(403);
    });

    it('un cabecera de otro PCD no lee el reporte', async () => {
      const res = await get(otroCabeceraToken, `/reportes/${reporteKineId}`);
      expect(res.status).toBe(403);
    });
  });

  describe('El cabecera arma su equipo', () => {
    it('asigna un especialista a su PCD', async () => {
      const res = await post(cabeceraToken, '/vinculos', {
        pcdId,
        profesionalId: fonoId + 0,
        rolProfesional: 'ESPECIALISTA',
      });
      // fonoId ya fue vinculado en un test anterior: 409. Se usa otro profesional.
      expect(res.status).toBe(409);

      const nuevo = await crearUsuario(app, {
        email: 'equipo.psico@e2e.com',
        tipoUsuario: TipoUsuario.PROFESIONAL,
        especialidad: 'Psicología',
      });
      const ok = await post(cabeceraToken, '/vinculos', {
        pcdId,
        profesionalId: nuevo.id,
        rolProfesional: 'ESPECIALISTA',
      });
      expect(ok.status).toBe(201);
      expect(ok.body.rolProfesional).toBe('ESPECIALISTA');
    });

    it('403: no asigna otro cabecera ni gestiona un PCD ajeno', async () => {
      const otro = await crearUsuario(app, {
        email: 'equipo.psico2@e2e.com',
        tipoUsuario: TipoUsuario.PROFESIONAL,
      });
      const cabecera2 = await post(cabeceraToken, '/vinculos', {
        pcdId,
        profesionalId: otro.id,
        rolProfesional: 'CABECERA',
      });
      expect(cabecera2.status).toBe(403);

      const ajeno = await post(cabeceraToken, '/vinculos', {
        pcdId: otroPcdId,
        profesionalId: otro.id,
        rolProfesional: 'ESPECIALISTA',
      });
      expect(ajeno.status).toBe(403);
    });

    it('403: un especialista o un tutor no asignan a nadie', async () => {
      const otro = await crearUsuario(app, {
        email: 'equipo.psico3@e2e.com',
        tipoUsuario: TipoUsuario.PROFESIONAL,
      });
      for (const token of [kineToken, tutorToken]) {
        const res = await post(token, '/vinculos', {
          pcdId,
          profesionalId: otro.id,
          rolProfesional: 'ESPECIALISTA',
        });
        expect(res.status).toBe(403);
      }
    });

    it('409: el Administrador no puede asignar un segundo cabecera activo', async () => {
      const otro = await crearUsuario(app, {
        email: 'equipo.psico4@e2e.com',
        tipoUsuario: TipoUsuario.PROFESIONAL,
      });
      const res = await post(adminToken, '/vinculos', {
        pcdId,
        profesionalId: otro.id,
        rolProfesional: 'CABECERA',
      });
      expect(res.status).toBe(409);
    });

    it('lista el equipo completo de su PCD y desactiva a un especialista', async () => {
      const equipo = await get(cabeceraToken, `/vinculos?pcdId=${pcdId}`);
      expect(equipo.status).toBe(200);
      const ids = equipo.body.map(
        (v: { profesionalId: number }) => v.profesionalId,
      );
      expect(ids).toEqual(expect.arrayContaining([cabeceraId, kineId, fonoId]));

      const baja = await request(app.getHttpServer())
        .patch(`/vinculos/${pcdId}/${fonoId}/status`)
        .set(...authHeader(cabeceraToken))
        .send({ estado: 'INACTIVO' });
      expect(baja.status).toBe(200);
      expect(baja.body.estado).toBe('INACTIVO');
    });

    it('un especialista, al listar, solo ve sus propios vínculos', async () => {
      const res = await get(kineToken, `/vinculos?pcdId=${pcdId}`);
      expect(res.status).toBe(200);
      expect(
        res.body.every(
          (v: { profesionalId: number }) => v.profesionalId === kineId,
        ),
      ).toBe(true);
    });

    it('403: el cabecera no desactiva al cabecera', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/vinculos/${pcdId}/${cabeceraId}/status`)
        .set(...authHeader(cabeceraToken))
        .send({ estado: 'INACTIVO' });
      expect(res.status).toBe(403);
    });
  });
});
