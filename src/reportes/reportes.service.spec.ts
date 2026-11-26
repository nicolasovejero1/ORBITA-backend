jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReporteProgreso } from './entities/reporte-progreso.entity';
import { ReporteAdjunto } from './entities/reporte-adjunto.entity';
import { ReporteColaborador } from './entities/reporte-colaborador.entity';
import { Actividad } from '../actividades/entities/actividad.entity';
import { ActividadInstancia } from '../actividades/entities/actividad-instancia.entity';
import { Profesional } from '../users/entities/profesional.entity';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import { AdjuntoUrlService } from './adjunto-url.service';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { TipoReporte } from '../common/enums/tipo-reporte.enum';
import { EstadoReporte } from '../common/enums/estado-reporte.enum';
import { TipoAdjunto } from '../common/enums/tipo-adjunto.enum';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';

describe('ReportesService', () => {
  let service: ReportesService;

  const qbMock = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const reporteRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((d: unknown) => d),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => qbMock),
  };
  const adjuntoRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((d: unknown) => d),
    delete: jest.fn(),
  };
  const colaboradorRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((d: unknown) => d),
    delete: jest.fn(),
  };
  const actividadRepo = { findOne: jest.fn() };
  const instanciaRepo = { findOne: jest.fn() };
  const profesionalRepo = { findOne: jest.fn() };
  const vinculoAccess = {
    assertVinculoActivo: jest.fn(),
    esCabeceraActivo: jest.fn(),
  };
  const adjuntoUrl = { firmar: jest.fn(), verificar: jest.fn() };

  const profesional: CallerInfo = {
    id: 10,
    email: 'prof',
    tipoUsuario: TipoUsuario.PROFESIONAL,
    esAdministrador: false,
  };
  const otroProfesional: CallerInfo = { ...profesional, id: 999 };
  const admin: CallerInfo = {
    id: 1,
    email: 'admin',
    tipoUsuario: TipoUsuario.ADMINISTRADOR,
    esAdministrador: true,
  };
  const tutor: CallerInfo = {
    id: 20,
    email: 'tutor',
    tipoUsuario: TipoUsuario.TUTOR,
    esAdministrador: false,
  };
  const pcdCaller: CallerInfo = {
    id: 30,
    email: 'pcd',
    tipoUsuario: TipoUsuario.PCD,
    esAdministrador: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    vinculoAccess.esCabeceraActivo.mockResolvedValue(false);
    qbMock.getMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportesService,
        { provide: getRepositoryToken(ReporteProgreso), useValue: reporteRepo },
        { provide: getRepositoryToken(ReporteAdjunto), useValue: adjuntoRepo },
        {
          provide: getRepositoryToken(ReporteColaborador),
          useValue: colaboradorRepo,
        },
        { provide: getRepositoryToken(Actividad), useValue: actividadRepo },
        {
          provide: getRepositoryToken(ActividadInstancia),
          useValue: instanciaRepo,
        },
        { provide: getRepositoryToken(Profesional), useValue: profesionalRepo },
        { provide: VinculoAccessService, useValue: vinculoAccess },
        { provide: AdjuntoUrlService, useValue: adjuntoUrl },
      ],
    }).compile();
    service = moduleRef.get(ReportesService);
  });

  describe('create', () => {
    it('lanza 404 si la actividad no existe', async () => {
      actividadRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          { titulo: 't', tipo: TipoReporte.DE_ACTIVIDAD, actividadId: 1 },
          profesional,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('exige vínculo activo del profesional con el PCD de la actividad', async () => {
      actividadRepo.findOne.mockResolvedValue({ id: 1, pcdId: 5 });
      vinculoAccess.assertVinculoActivo.mockRejectedValue(
        new ForbiddenException('sin vínculo'),
      );
      await expect(
        service.create(
          { titulo: 't', tipo: TipoReporte.DE_ACTIVIDAD, actividadId: 1 },
          profesional,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza una sesión puntual en un reporte MENSUAL o FINAL', async () => {
      actividadRepo.findOne.mockResolvedValue({ id: 1, pcdId: 5 });
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      for (const tipo of [TipoReporte.MENSUAL, TipoReporte.FINAL]) {
        await expect(
          service.create(
            { titulo: 't', tipo, actividadId: 1, instanciaId: 9 },
            profesional,
          ),
        ).rejects.toThrow(BadRequestException);
      }
      expect(reporteRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza si la instancia no pertenece a la actividad indicada', async () => {
      actividadRepo.findOne.mockResolvedValue({ id: 1, pcdId: 5 });
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      instanciaRepo.findOne.mockResolvedValue({ id: 9, actividadId: 999 });
      await expect(
        service.create(
          {
            titulo: 't',
            tipo: TipoReporte.DE_ACTIVIDAD,
            actividadId: 1,
            instanciaId: 9,
          },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el reporte (nace EN_CURSO por defecto)', async () => {
      actividadRepo.findOne.mockResolvedValue({ id: 1, pcdId: 5 });
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      reporteRepo.save.mockResolvedValue({ id: 100 });
      reporteRepo.findOne.mockResolvedValue({
        id: 100,
        estado: EstadoReporte.EN_CURSO,
      });

      await service.create(
        { titulo: 't', tipo: TipoReporte.DE_ACTIVIDAD, actividadId: 1 },
        profesional,
      );

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ profesionalId: profesional.id }),
      );
    });
  });

  describe('findAll', () => {
    it('Admin sin pcdId: no filtra por pcd', async () => {
      await service.findAll(admin);
      expect(qbMock.andWhere).not.toHaveBeenCalledWith(
        'actividad.pcdId = :pcdId',
        expect.anything(),
      );
    });

    it('Profesional: filtra por propios + colaboraciones', async () => {
      await service.findAll(profesional);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('reporte.profesionalId = :callerId'),
        expect.objectContaining({ callerId: profesional.id }),
      );
    });

    it('Tutor: exige FINALIZADO + visibilidadTutor + vínculo activo (innerJoin)', async () => {
      await service.findAll(tutor);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'reporte.visibilidadTutor = true',
      );
      expect(qbMock.innerJoin).toHaveBeenCalled();
    });

    it('PCD: solo FINALIZADOS y visibles de sus propias actividades', async () => {
      await service.findAll(pcdCaller);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'actividad.pcdId = :callerId',
        { callerId: pcdCaller.id },
      );
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'reporte.estado = :finalizado',
        {
          finalizado: EstadoReporte.FINALIZADO,
        },
      );
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'reporte.visibilidadTutor = true',
      );
    });
  });

  describe('findColaboraciones', () => {
    it('arma el query con innerJoin sobre reporte_colaboradores', async () => {
      await service.findColaboraciones(profesional);
      expect(qbMock.innerJoin).toHaveBeenCalled();
      expect(qbMock.getMany).toHaveBeenCalled();
    });
  });

  describe('verificarAcceso (vía findOne)', () => {
    const reporteBase = {
      id: 1,
      profesionalId: profesional.id,
      actividadId: 7,
      estado: EstadoReporte.EN_CURSO,
      visibilidadTutor: false,
      colaboradores: [] as { profesionalId: number }[],
      actividad: { pcdId: 5 },
    };

    it('Admin accede sin restricciones', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteBase);
      await expect(service.findOne(1, admin)).resolves.toEqual(reporteBase);
    });

    it('Profesional creador accede', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteBase);
      await expect(service.findOne(1, profesional)).resolves.toEqual(
        reporteBase,
      );
    });

    it('Profesional colaborador accede', async () => {
      reporteRepo.findOne.mockResolvedValue({
        ...reporteBase,
        colaboradores: [{ profesionalId: otroProfesional.id }],
        actividad: { pcdId: 5 },
      });
      await expect(service.findOne(1, otroProfesional)).resolves.toBeDefined();
    });

    it('Profesional ajeno (ni creador ni colaborador) es rechazado', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteBase);
      await expect(service.findOne(1, otroProfesional)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Tutor rechazado si el reporte no está FINALIZADO', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteBase);
      await expect(service.findOne(1, tutor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Tutor rechazado si FINALIZADO pero sin visibilidadTutor', async () => {
      reporteRepo.findOne.mockResolvedValue({
        ...reporteBase,
        estado: EstadoReporte.FINALIZADO,
        visibilidadTutor: false,
      });
      await expect(service.findOne(1, tutor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Tutor accede si FINALIZADO + visible + vínculo activo', async () => {
      reporteRepo.findOne.mockResolvedValue({
        ...reporteBase,
        estado: EstadoReporte.FINALIZADO,
        visibilidadTutor: true,
      });
      actividadRepo.findOne.mockResolvedValue({ id: 7, pcdId: 5 });
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      await expect(service.findOne(1, tutor)).resolves.toBeDefined();
      expect(vinculoAccess.assertVinculoActivo).toHaveBeenCalledWith(
        tutor.id,
        TipoUsuario.TUTOR,
        5,
      );
    });

    it('PCD dueño de la actividad accede si FINALIZADO + visible', async () => {
      reporteRepo.findOne.mockResolvedValue({
        ...reporteBase,
        estado: EstadoReporte.FINALIZADO,
        visibilidadTutor: true,
      });
      actividadRepo.findOne.mockResolvedValue({ id: 7, pcdId: pcdCaller.id });
      await expect(service.findOne(1, pcdCaller)).resolves.toBeDefined();
    });

    it('PCD dueño rechazado si el reporte no está FINALIZADO', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteBase);
      actividadRepo.findOne.mockResolvedValue({ id: 7, pcdId: pcdCaller.id });
      await expect(service.findOne(1, pcdCaller)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('PCD dueño rechazado si FINALIZADO pero sin visibilidadTutor', async () => {
      reporteRepo.findOne.mockResolvedValue({
        ...reporteBase,
        estado: EstadoReporte.FINALIZADO,
      });
      actividadRepo.findOne.mockResolvedValue({ id: 7, pcdId: pcdCaller.id });
      await expect(service.findOne(1, pcdCaller)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('PCD ajeno es rechazado', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteBase);
      actividadRepo.findOne.mockResolvedValue({ id: 7, pcdId: 999 });
      await expect(service.findOne(1, pcdCaller)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update / changeEstado / remove — inmutabilidad de FINALIZADO', () => {
    const reporteAbierto = {
      id: 1,
      profesionalId: profesional.id,
      actividadId: 7,
      estado: EstadoReporte.EN_CURSO,
      visibilidadTutor: false,
      colaboradores: [],
      actividad: { pcdId: 5 },
    };
    const reporteFinalizado = {
      ...reporteAbierto,
      estado: EstadoReporte.FINALIZADO,
    };

    it('update: rechaza si no es el creador', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await expect(
        service.update(1, { titulo: 'x' }, otroProfesional),
      ).rejects.toThrow(ForbiddenException);
    });

    it('update: rechaza si el reporte está FINALIZADO', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteFinalizado);
      await expect(
        service.update(1, { titulo: 'x' }, profesional),
      ).rejects.toThrow(ConflictException);
    });

    it('update: flujo feliz, el creador modifica un reporte abierto', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await service.update(1, { titulo: 'Nuevo título' }, profesional);
      expect(reporteRepo.update).toHaveBeenCalledWith(1, {
        titulo: 'Nuevo título',
      });
    });

    it('changeEstado: rechaza si no es el creador ni Admin', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await expect(
        service.changeEstado(
          1,
          { estado: EstadoReporte.EN_CURSO },
          otroProfesional,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('remove: rechaza si no es el creador ni Admin', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await expect(service.remove(1, otroProfesional)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Profesional con permisos de administrador que no es el creador: no modifica, no finaliza ni elimina', async () => {
      const profAdmin: CallerInfo = {
        ...otroProfesional,
        esAdministrador: true,
      };
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await expect(
        service.update(1, { titulo: 'x' }, profAdmin),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.changeEstado(
          1,
          { estado: EstadoReporte.FINALIZADO },
          profAdmin,
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.remove(1, profAdmin)).rejects.toThrow(
        ForbiddenException,
      );
      expect(reporteRepo.update).not.toHaveBeenCalled();
      expect(reporteRepo.delete).not.toHaveBeenCalled();
    });

    it('changeEstado: rechaza visibilidadTutor=true sin FINALIZADO', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await expect(
        service.changeEstado(
          1,
          { estado: EstadoReporte.EN_CURSO, visibilidadTutor: true },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('changeEstado: permite finalizar activando visibilidadTutor', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await service.changeEstado(
        1,
        { estado: EstadoReporte.FINALIZADO, visibilidadTutor: true },
        profesional,
      );
      expect(reporteRepo.update).toHaveBeenCalledWith(1, {
        estado: EstadoReporte.FINALIZADO,
        visibilidadTutor: true,
      });
    });

    it('changeEstado: un reporte ya FINALIZADO no puede volver a cambiar de estado', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteFinalizado);
      await expect(
        service.changeEstado(
          1,
          { estado: EstadoReporte.FINALIZADO },
          profesional,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('remove: rechaza si está FINALIZADO', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteFinalizado);
      await expect(service.remove(1, profesional)).rejects.toThrow(
        ConflictException,
      );
    });

    it('remove: el creador puede eliminar un reporte no finalizado', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await service.remove(1, profesional);
      expect(reporteRepo.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('adjuntos (BUG CORREGIDO: removeAdjunto ahora sí bloquea FINALIZADO)', () => {
    const reporteAbierto = {
      id: 1,
      profesionalId: profesional.id,
      actividadId: 7,
      estado: EstadoReporte.EN_CURSO,
      visibilidadTutor: false,
      colaboradores: [],
      actividad: { pcdId: 5 },
    };
    const reporteFinalizado = {
      ...reporteAbierto,
      estado: EstadoReporte.FINALIZADO,
    };

    it('addAdjunto: rechaza si el reporte está FINALIZADO', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteFinalizado);
      await expect(
        service.addAdjunto(1, { filePath: 'https://x.com/a' }, profesional),
      ).rejects.toThrow(ConflictException);
    });

    it('removeAdjunto: rechaza si el reporte está FINALIZADO (antes no lo validaba)', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteFinalizado);
      await expect(service.removeAdjunto(1, 5, profesional)).rejects.toThrow(
        ConflictException,
      );
      expect(adjuntoRepo.delete).not.toHaveBeenCalled();
    });

    it('removeAdjunto: rechaza si no es el creador', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await expect(
        service.removeAdjunto(1, 5, otroProfesional),
      ).rejects.toThrow(ForbiddenException);
    });

    it('removeAdjunto: elimina el adjunto de un reporte no finalizado', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      adjuntoRepo.findOne.mockResolvedValue({ id: 5, reporteId: 1 });
      await service.removeAdjunto(1, 5, profesional);
      expect(adjuntoRepo.delete).toHaveBeenCalledWith(5);
    });

    it('removeAdjunto: 404 si el adjunto no existe o no pertenece al reporte', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      adjuntoRepo.findOne.mockResolvedValue(null);
      await expect(service.removeAdjunto(1, 999, profesional)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('addAdjunto: rechaza si no es el creador', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      await expect(
        service.addAdjunto(1, { filePath: 'https://x.com/a' }, otroProfesional),
      ).rejects.toThrow(ForbiddenException);
    });

    it('addAdjunto: flujo feliz', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      adjuntoRepo.save.mockResolvedValue({ id: 1, reporteId: 1 });
      const result = await service.addAdjunto(
        1,
        { filePath: 'https://x.com/a' },
        profesional,
      );
      expect(result).toEqual({ id: 1, reporteId: 1 });
      expect(adjuntoRepo.create).toHaveBeenCalledWith({
        reporteId: 1,
        tipoArchivo: TipoAdjunto.URL,
        filePath: 'https://x.com/a',
      });
    });
  });

  describe('cabecera: lee todos los reportes de sus pacientes', () => {
    it('un profesional ajeno que es cabecera del PCD accede al reporte', async () => {
      reporteRepo.findOne.mockResolvedValue({
        id: 1,
        profesionalId: profesional.id,
        estado: EstadoReporte.EN_CURSO,
        colaboradores: [],
        actividad: { pcdId: 5 },
      });
      vinculoAccess.esCabeceraActivo.mockResolvedValue(true);
      await expect(service.findOne(1, otroProfesional)).resolves.toBeDefined();
      expect(vinculoAccess.esCabeceraActivo).toHaveBeenCalledWith(
        otroProfesional.id,
        5,
      );
    });

    it('si no es cabecera de ese PCD, se rechaza', async () => {
      reporteRepo.findOne.mockResolvedValue({
        id: 1,
        profesionalId: profesional.id,
        estado: EstadoReporte.EN_CURSO,
        colaboradores: [],
        actividad: { pcdId: 5 },
      });
      await expect(service.findOne(1, otroProfesional)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('urlAdjunto / archivoAdjunto (enlaces firmados)', () => {
    const reporteConAcceso = {
      id: 1,
      profesionalId: profesional.id,
      estado: EstadoReporte.EN_CURSO,
      colaboradores: [],
      actividad: { pcdId: 5 },
    };

    it('entrega un enlace firmado para un archivo local a quien ve el reporte', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteConAcceso);
      adjuntoRepo.findOne.mockResolvedValue({
        id: 7,
        reporteId: 1,
        filePath: '/uploads/reportes/a.png',
      });
      adjuntoUrl.firmar.mockReturnValue('tok');

      const res = await service.urlAdjunto(1, 7, profesional);

      expect(adjuntoUrl.firmar).toHaveBeenCalledWith(1, 7);
      expect(res).toEqual({
        url: '/reportes/adjuntos/archivo?token=tok',
        externo: false,
        expiraEnSegundos: 60,
      });
    });

    it('devuelve tal cual un enlace externo, sin firmar', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteConAcceso);
      adjuntoRepo.findOne.mockResolvedValue({
        id: 8,
        reporteId: 1,
        filePath: 'https://ejemplo.com/informe.pdf',
      });

      const res = await service.urlAdjunto(1, 8, profesional);

      expect(adjuntoUrl.firmar).not.toHaveBeenCalled();
      expect(res).toEqual({
        url: 'https://ejemplo.com/informe.pdf',
        externo: true,
        expiraEnSegundos: null,
      });
    });

    it('rechaza a quien no puede ver el reporte', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteConAcceso);
      await expect(service.urlAdjunto(1, 7, otroProfesional)).rejects.toThrow(
        ForbiddenException,
      );
      expect(adjuntoUrl.firmar).not.toHaveBeenCalled();
    });

    it('404 si el adjunto es de otro reporte', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteConAcceso);
      adjuntoRepo.findOne.mockResolvedValue({
        id: 7,
        reporteId: 2,
        filePath: '/uploads/reportes/a.png',
      });
      await expect(service.urlAdjunto(1, 7, profesional)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('archivoAdjunto: 401 sin token', async () => {
      await expect(service.archivoAdjunto(undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('archivoAdjunto: 401 con un token vencido o inválido', async () => {
      adjuntoUrl.verificar.mockRejectedValue(new UnauthorizedException());
      await expect(service.archivoAdjunto('malo')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('archivoAdjunto: resuelve la ruta dentro de uploads/reportes', async () => {
      adjuntoUrl.verificar.mockResolvedValue({ rep: 1, adj: 7 });
      adjuntoRepo.findOne.mockResolvedValue({
        id: 7,
        reporteId: 1,
        filePath: '/uploads/reportes/../../secreto/a.png',
      });
      // El prefijo no alcanza para escapar: se toma solo el nombre del archivo.
      const res = await service.archivoAdjunto('tok');
      expect(res.nombre).toBe('a.png');
      expect(res.ruta).toContain('reportes');
      expect(res.ruta).not.toContain('secreto');
    });

    it('archivoAdjunto: 404 si el token no corresponde al reporte del adjunto', async () => {
      adjuntoUrl.verificar.mockResolvedValue({ rep: 99, adj: 7 });
      adjuntoRepo.findOne.mockResolvedValue({
        id: 7,
        reporteId: 1,
        filePath: '/uploads/reportes/a.png',
      });
      await expect(service.archivoAdjunto('tok')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('agregarArchivoAdjunto (upload real)', () => {
    const reporteAbierto = {
      id: 1,
      profesionalId: profesional.id,
      actividadId: 7,
      estado: EstadoReporte.EN_CURSO,
      visibilidadTutor: false,
      colaboradores: [],
      actividad: { pcdId: 5 },
    };

    it('rechaza si no se recibió ningún archivo', async () => {
      await expect(
        service.agregarArchivoAdjunto(1, undefined, profesional),
      ).rejects.toThrow(BadRequestException);
    });

    it('flujo feliz: guarda el archivo y crea el adjunto como IMAGEN', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      adjuntoRepo.save.mockResolvedValue({ id: 1, tipoArchivo: 'IMAGEN' });

      const file = {
        mimetype: 'image/png',
        originalname: 'foto.png',
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      const result = await service.agregarArchivoAdjunto(1, file, profesional);
      expect(adjuntoRepo.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, tipoArchivo: 'IMAGEN' });
    });

    it('flujo feliz: PDF usa la extensión .pdf', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      adjuntoRepo.save.mockImplementation((d: unknown) =>
        Promise.resolve(d as Record<string, unknown>),
      );

      const file = {
        mimetype: 'application/pdf',
        originalname: 'informe.pdf',
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      const result = (await service.agregarArchivoAdjunto(
        1,
        file,
        profesional,
      )) as { filePath: string; tipoArchivo: string };
      expect(result.tipoArchivo).toBe('PDF');
      expect(result.filePath).toMatch(/\.pdf$/);
    });

    it('rechaza mimetypes que no sean imagen ni PDF', async () => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
      const file = {
        mimetype: 'text/plain',
        originalname: 'x.txt',
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      await expect(
        service.agregarArchivoAdjunto(1, file, profesional),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('colaboradores', () => {
    const reporteAbierto = {
      id: 1,
      profesionalId: profesional.id,
      actividadId: 7,
      estado: EstadoReporte.EN_CURSO,
      visibilidadTutor: false,
      colaboradores: [],
      actividad: { pcdId: 5 },
    };

    beforeEach(() => {
      reporteRepo.findOne.mockResolvedValue(reporteAbierto);
    });

    it('rechaza que el creador se agregue a sí mismo', async () => {
      await expect(
        service.addColaborador(
          1,
          { profesionalId: profesional.id },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el profesional a agregar no existe', async () => {
      profesionalRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addColaborador(1, { profesionalId: 55 }, profesional),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza colaborador duplicado', async () => {
      profesionalRepo.findOne.mockResolvedValue({ userId: 55 });
      colaboradorRepo.findOne.mockResolvedValue({
        profesionalId: 55,
        reporteId: 1,
      });
      await expect(
        service.addColaborador(1, { profesionalId: 55 }, profesional),
      ).rejects.toThrow(ConflictException);
    });

    it('addColaborador: flujo feliz', async () => {
      profesionalRepo.findOne.mockResolvedValue({ userId: 55 });
      colaboradorRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ profesionalId: 55, reporteId: 1 });
      colaboradorRepo.save.mockResolvedValue({
        profesionalId: 55,
        reporteId: 1,
      });

      const result = await service.addColaborador(
        1,
        { profesionalId: 55 },
        profesional,
      );
      expect(colaboradorRepo.save).toHaveBeenCalled();
      expect(result).toEqual({ profesionalId: 55, reporteId: 1 });
    });

    it('addColaborador: también se puede sumar a un reporte FINALIZADO', async () => {
      reporteRepo.findOne.mockResolvedValue({
        ...reporteAbierto,
        estado: EstadoReporte.FINALIZADO,
      });
      profesionalRepo.findOne.mockResolvedValue({ userId: 55 });
      colaboradorRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ profesionalId: 55, reporteId: 1 });
      colaboradorRepo.save.mockResolvedValue({
        profesionalId: 55,
        reporteId: 1,
      });

      await service.addColaborador(1, { profesionalId: 55 }, profesional);
      expect(colaboradorRepo.save).toHaveBeenCalled();
    });

    it('findColaboradores: rechaza si no es creador ni Admin', async () => {
      await expect(
        service.findColaboradores(1, otroProfesional),
      ).rejects.toThrow(ForbiddenException);
    });

    it('findColaboradores: flujo feliz para el creador', async () => {
      colaboradorRepo.find.mockResolvedValue([{ profesionalId: 55 }]);
      const result = await service.findColaboradores(1, profesional);
      expect(result).toEqual([{ profesionalId: 55 }]);
    });

    it('removeColaborador: rechaza si no es el creador', async () => {
      await expect(
        service.removeColaborador(1, 55, otroProfesional),
      ).rejects.toThrow(ForbiddenException);
    });

    it('removeColaborador: 404 si no es colaborador', async () => {
      colaboradorRepo.findOne.mockResolvedValue(null);
      await expect(
        service.removeColaborador(1, 55, profesional),
      ).rejects.toThrow(NotFoundException);
    });

    it('removeColaborador: flujo feliz', async () => {
      colaboradorRepo.findOne.mockResolvedValue({
        profesionalId: 55,
        reporteId: 1,
      });
      const result = await service.removeColaborador(1, 55, profesional);
      expect(colaboradorRepo.delete).toHaveBeenCalledWith({
        profesionalId: 55,
        reporteId: 1,
      });
      expect(result).toEqual({
        message: 'Colaborador 55 removido correctamente',
      });
    });
  });
});
