import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ActividadesService } from './actividades.service';
import { Actividad } from './entities/actividad.entity';
import { ActividadInstancia } from './entities/actividad-instancia.entity';
import { Medicamento } from '../medicamentos/entities/medicamento.entity';
import { Terapia } from '../terapias/entities/terapia.entity';
import { Profesional } from '../users/entities/profesional.entity';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { TipoActividad } from '../common/enums/tipo-actividad.enum';
import { FrecuenciaActividad } from '../common/enums/frecuencia-actividad.enum';
import { EstadoActividad } from '../common/enums/estado-actividad.enum';
import { OrdenActividad } from '../common/enums/orden-actividad.enum';
import { EstadoInstancia } from '../common/enums/estado-instancia.enum';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';

describe('ActividadesService', () => {
  let service: ActividadesService;

  const qbMock = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const actividadRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => qbMock),
  };
  const instanciaRepo = {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const medicamentoRepo = { find: jest.fn() };
  const terapiaRepo = { findOne: jest.fn() };
  const vinculoAccess = {
    assertVinculoActivo: jest.fn(),
    esCabeceraActivo: jest.fn(),
  };
  const profesionalRepo = { findOne: jest.fn() };

  const managerStub = {
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => data),
    save: jest.fn((data: unknown) =>
      Array.isArray(data)
        ? Promise.resolve(data)
        : Promise.resolve({ id: 1, ...(data as Record<string, unknown>) }),
    ),
    update: jest.fn(),
    delete: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof managerStub) => unknown) =>
      cb(managerStub),
    ),
  };

  const admin: CallerInfo = {
    id: 1,
    email: 'admin',
    tipoUsuario: TipoUsuario.ADMINISTRADOR,
    esAdministrador: true,
  };
  const profesional: CallerInfo = {
    id: 10,
    email: 'prof',
    tipoUsuario: TipoUsuario.PROFESIONAL,
    esAdministrador: false,
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

  const dtoBase = {
    titulo: 'Ejercicios',
    descripcion: 'Serie de ejercicios',
    fechaInicio: '2025-06-01',
    fechaFin: '2025-07-01',
    tipoActividad: TipoActividad.EJERCICIO,
    frecuencia: FrecuenciaActividad.DIARIA,
    pcdId: 30,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    vinculoAccess.esCabeceraActivo.mockResolvedValue(false);
    profesionalRepo.findOne.mockResolvedValue({
      userId: profesional.id,
      especialidadId: 5,
    });
    qbMock.getMany.mockResolvedValue([]);
    managerStub.find.mockResolvedValue([]);
    managerStub.count.mockResolvedValue(0);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ActividadesService,
        { provide: getRepositoryToken(Actividad), useValue: actividadRepo },
        {
          provide: getRepositoryToken(ActividadInstancia),
          useValue: instanciaRepo,
        },
        { provide: getRepositoryToken(Medicamento), useValue: medicamentoRepo },
        { provide: getRepositoryToken(Terapia), useValue: terapiaRepo },
        {
          provide: getRepositoryToken(Profesional),
          useValue: profesionalRepo,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: VinculoAccessService, useValue: vinculoAccess },
      ],
    }).compile();
    service = moduleRef.get(ActividadesService);
  });

  describe('create', () => {
    it('RN-012: un Tutor no puede crear actividades de tipo TERAPIA', async () => {
      await expect(
        service.create(
          { ...dtoBase, tipoActividad: TipoActividad.TERAPIA, terapiaId: 1 },
          tutor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(vinculoAccess.assertVinculoActivo).not.toHaveBeenCalled();
    });

    it('RN-013: exige vínculo activo con el PCD, sin filtrar por rolProfesional (decisión #1: sin restricción CABECERA)', async () => {
      vinculoAccess.assertVinculoActivo.mockRejectedValue(
        new ForbiddenException('sin vínculo'),
      );
      await expect(service.create(dtoBase, profesional)).rejects.toThrow(
        ForbiddenException,
      );
      expect(vinculoAccess.assertVinculoActivo).toHaveBeenCalledWith(
        profesional.id,
        profesional.tipoUsuario,
        dtoBase.pcdId,
      );
    });

    it('RN-014: rechaza si fechaFin no es posterior a fechaInicio', async () => {
      await expect(
        service.create(
          { ...dtoBase, fechaInicio: '2025-06-10', fechaFin: '2025-06-01' },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('RN-014: rechaza si el rango supera los 6 meses', async () => {
      await expect(
        service.create(
          { ...dtoBase, fechaInicio: '2025-01-01', fechaFin: '2025-12-01' },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('RN-015: MEDICAMENTO sin medicamentos requeridos es rechazado', async () => {
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      await expect(
        service.create(
          { ...dtoBase, tipoActividad: TipoActividad.MEDICAMENTO },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('RN-015: rechaza si algún medicamento no existe en el catálogo', async () => {
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      medicamentoRepo.find.mockResolvedValue([{ id: 1 }]); // falta el id 2
      await expect(
        service.create(
          {
            ...dtoBase,
            tipoActividad: TipoActividad.MEDICAMENTO,
            medicamentos: [{ medicamentoId: 1 }, { medicamentoId: 2 }],
          },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('RN-016: rechaza si la terapia no existe en el catálogo', async () => {
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      terapiaRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          { ...dtoBase, tipoActividad: TipoActividad.TERAPIA, terapiaId: 99 },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('RN-017: DIAS_ESPECIFICOS sin diasSemana es rechazado', async () => {
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      await expect(
        service.create(
          {
            ...dtoBase,
            frecuencia: FrecuenciaActividad.DIAS_ESPECIFICOS,
            diasSemana: [],
          },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea la actividad y sus instancias en una transacción', async () => {
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      actividadRepo.findOne.mockResolvedValue({ id: 1, ...dtoBase });

      await service.create(dtoBase, profesional);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(managerStub.save).toHaveBeenCalled();
    });

    it('crea una actividad MEDICAMENTO guardando el detalle de cada medicamento', async () => {
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      medicamentoRepo.find.mockResolvedValue([{ id: 1 }]);
      actividadRepo.findOne.mockResolvedValue({ id: 1 });

      await service.create(
        {
          ...dtoBase,
          tipoActividad: TipoActividad.MEDICAMENTO,
          medicamentos: [{ medicamentoId: 1, dosis: '400mg' }],
        },
        profesional,
      );

      expect(managerStub.save).toHaveBeenCalledWith([
        expect.objectContaining({ medicamentoId: 1, dosis: '400mg' }),
      ]);
    });

    it('crea una actividad TERAPIA guardando el vínculo con la terapia', async () => {
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      terapiaRepo.findOne.mockResolvedValue({ id: 5, especialidadId: 5 });
      actividadRepo.findOne.mockResolvedValue({ id: 1 });

      await service.create(
        { ...dtoBase, tipoActividad: TipoActividad.TERAPIA, terapiaId: 5 },
        profesional,
      );

      expect(managerStub.save).toHaveBeenCalledWith(
        expect.objectContaining({ terapiaId: 5 }),
      );
    });

    describe('terapias por especialidad', () => {
      const dtoTerapia = {
        ...dtoBase,
        tipoActividad: TipoActividad.TERAPIA,
        terapiaId: 5,
      };

      beforeEach(() => {
        vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
        actividadRepo.findOne.mockResolvedValue({ id: 1 });
      });

      it('un especialista programa una terapia de su especialidad', async () => {
        terapiaRepo.findOne.mockResolvedValue({ id: 5, especialidadId: 5 });
        await service.create(dtoTerapia, profesional);
        expect(managerStub.save).toHaveBeenCalled();
      });

      it('un especialista no programa una terapia de otra especialidad (403)', async () => {
        terapiaRepo.findOne.mockResolvedValue({ id: 5, especialidadId: 6 });
        await expect(service.create(dtoTerapia, profesional)).rejects.toThrow(
          ForbiddenException,
        );
        expect(managerStub.save).not.toHaveBeenCalled();
      });

      it('un especialista no programa una terapia sin especialidad (403)', async () => {
        terapiaRepo.findOne.mockResolvedValue({ id: 5, especialidadId: null });
        await expect(service.create(dtoTerapia, profesional)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('el cabecera del PCD programa cualquier terapia', async () => {
        vinculoAccess.esCabeceraActivo.mockResolvedValue(true);
        terapiaRepo.findOne.mockResolvedValue({ id: 5, especialidadId: 6 });
        await service.create(dtoTerapia, profesional);
        expect(vinculoAccess.esCabeceraActivo).toHaveBeenCalledWith(
          profesional.id,
          dtoTerapia.pcdId,
        );
        expect(managerStub.save).toHaveBeenCalled();
      });
    });

    it('setea horarioInicio/horarioFin formateados cuando se especifican', async () => {
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      actividadRepo.findOne.mockResolvedValue({ id: 1 });

      await service.create(
        { ...dtoBase, horarioInicio: '09:05', horarioFin: '10:00' },
        profesional,
      );

      const actividadGuardada = managerStub.create.mock.calls.find(
        (call) => call[0] === Actividad,
      )?.[1] as { horarioInicio: string; horarioFin: string };
      expect(actividadGuardada.horarioInicio).toBe('09:05:00');
      expect(actividadGuardada.horarioFin).toBe('10:00:00');
    });
  });

  describe('findAll', () => {
    it('Admin sin pcdId: no agrega filtro por pcd', async () => {
      await service.findAll(admin);
      expect(qbMock.andWhere).not.toHaveBeenCalled();
    });

    it('Admin con pcdId: filtra por ese pcd', async () => {
      await service.findAll(admin, 5);
      expect(qbMock.andWhere).toHaveBeenCalledWith('actividad.pcdId = :pcdId', {
        pcdId: 5,
      });
    });

    it('Profesional: las propias y las de los PCD de los que es cabecera', async () => {
      await service.findAll(profesional);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('actividad.creadoPorUserId = :callerId OR'),
        expect.objectContaining({ callerId: profesional.id }),
      );
    });

    it('estado: agrega el filtro por estado', async () => {
      await service.findAll(profesional, undefined, EstadoActividad.COMPLETADA);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'actividad.estado = :estado',
        { estado: EstadoActividad.COMPLETADA },
      );
    });

    it('orden=horario: por horario de inicio, las sin horario al final y, a igual horario, por fecha', async () => {
      qbMock.getMany.mockResolvedValueOnce([
        { id: 1, horarioInicio: null, fechaInicio: '2026-01-01' },
        { id: 2, horarioInicio: '15:00:00', fechaInicio: '2026-01-01' },
        { id: 3, horarioInicio: '07:30:00', fechaInicio: '2026-01-05' },
        { id: 4, horarioInicio: '07:30:00', fechaInicio: '2026-01-02' },
      ]);
      const res = await service.findAll(
        profesional,
        undefined,
        undefined,
        OrdenActividad.HORARIO,
      );
      expect(res.map((a) => a.id)).toEqual([4, 3, 2, 1]);
    });

    it('Tutor: hace innerJoin con TutorPcd filtrando por vínculo ACTIVO', async () => {
      await service.findAll(tutor);
      expect(qbMock.innerJoin).toHaveBeenCalled();
    });

    it('PCD: filtra solo por sus propias actividades', async () => {
      await service.findAll(pcdCaller);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'actividad.pcdId = :callerId',
        { callerId: pcdCaller.id },
      );
    });
  });

  describe('findOne / verificarAcceso', () => {
    const actividad = {
      id: 1,
      creadoPorUserId: profesional.id,
      pcdId: pcdCaller.id,
    };

    it('lanza 404 si no existe', async () => {
      actividadRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1, admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Admin accede sin restricciones', async () => {
      actividadRepo.findOne.mockResolvedValue(actividad);
      await expect(service.findOne(1, admin)).resolves.toEqual(actividad);
    });

    it('Profesional creador accede', async () => {
      actividadRepo.findOne.mockResolvedValue(actividad);
      await expect(service.findOne(1, profesional)).resolves.toEqual(actividad);
    });

    it('el cabecera del PCD accede a una actividad ajena', async () => {
      actividadRepo.findOne.mockResolvedValue(actividad);
      vinculoAccess.esCabeceraActivo.mockResolvedValue(true);
      const otroProfesional = { ...profesional, id: 999 };
      await expect(service.findOne(1, otroProfesional)).resolves.toEqual(
        actividad,
      );
    });

    it('Profesional NO creador es rechazado', async () => {
      actividadRepo.findOne.mockResolvedValue(actividad);
      const otroProfesional = { ...profesional, id: 999 };
      await expect(service.findOne(1, otroProfesional)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('PCD dueño accede', async () => {
      actividadRepo.findOne.mockResolvedValue(actividad);
      await expect(service.findOne(1, pcdCaller)).resolves.toEqual(actividad);
    });

    it('PCD ajeno es rechazado', async () => {
      actividadRepo.findOne.mockResolvedValue(actividad);
      const otroPcd = { ...pcdCaller, id: 999 };
      await expect(service.findOne(1, otroPcd)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('BUG CORREGIDO: Tutor SIN vínculo activo con el PCD es rechazado (antes pasaba sin validar)', async () => {
      actividadRepo.findOne.mockResolvedValue(actividad);
      vinculoAccess.assertVinculoActivo.mockRejectedValue(
        new ForbiddenException('sin vínculo'),
      );
      await expect(service.findOne(1, tutor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(vinculoAccess.assertVinculoActivo).toHaveBeenCalledWith(
        tutor.id,
        TipoUsuario.TUTOR,
        actividad.pcdId,
      );
    });

    it('Tutor CON vínculo activo accede', async () => {
      actividadRepo.findOne.mockResolvedValue(actividad);
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      await expect(service.findOne(1, tutor)).resolves.toEqual(actividad);
    });
  });

  describe('update / updateEstado / remove (RN-020)', () => {
    // Fechas relativas a "hoy" (no fijas): la actividad "ya arrancó" y sigue
    // vigente, sin importar cuándo corra la suite — necesario para el test
    // de regeneración de instancias, que recorta el rango a partir de hoy.
    const hace10Dias = new Date();
    hace10Dias.setDate(hace10Dias.getDate() - 10);
    const en20Dias = new Date();
    en20Dias.setDate(en20Dias.getDate() + 20);

    const actividad = {
      id: 1,
      creadoPorUserId: profesional.id,
      pcdId: pcdCaller.id,
      tipoActividad: TipoActividad.EJERCICIO,
      frecuencia: FrecuenciaActividad.DIARIA,
      // string 'YYYY-MM-DD', no Date — así es como TypeORM+mysql2 devuelve
      // columnas `date` en la app real (ver date.utils.ts).
      fechaInicio: hace10Dias.toISOString().slice(0, 10),
      fechaFin: en20Dias.toISOString().slice(0, 10),
      diasSemana: null,
    };

    beforeEach(() => {
      actividadRepo.findOne.mockResolvedValue(actividad);
    });

    it('update: rechaza si no es el creador', async () => {
      const otro = { ...profesional, id: 999 };
      await expect(service.update(1, { titulo: 'x' }, otro)).rejects.toThrow(
        ForbiddenException,
      );
    });

    // Regla "solo el creador": el permiso de administrador no habilita a
    // gestionar actividades ajenas.
    it('update/updateEstado/remove: un Profesional con permisos de admin que no es el creador recibe 403', async () => {
      const profAdmin = { ...profesional, id: 11, esAdministrador: true };
      await expect(
        service.update(1, { titulo: 'x' }, profAdmin),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateEstado(
          1,
          { estado: EstadoActividad.COMPLETADA },
          profAdmin,
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.remove(1, profAdmin)).rejects.toThrow(
        ForbiddenException,
      );
      expect(actividadRepo.update).not.toHaveBeenCalled();
      expect(actividadRepo.delete).not.toHaveBeenCalled();
    });

    it('update: rechaza terapiaId en actividad que no es TERAPIA', async () => {
      await expect(
        service.update(1, { terapiaId: 5 }, profesional),
      ).rejects.toThrow(BadRequestException);
    });

    it('update: rechaza medicamentos en actividad que no es MEDICAMENTO', async () => {
      await expect(
        service.update(
          1,
          { medicamentos: [{ medicamentoId: 1 }] },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('updateEstado: rechaza COMPLETADA si hay instancias PENDIENTE', async () => {
      instanciaRepo.count.mockResolvedValue(2);
      await expect(
        service.updateEstado(
          1,
          { estado: EstadoActividad.COMPLETADA },
          profesional,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('updateEstado: permite COMPLETADA sin instancias pendientes', async () => {
      instanciaRepo.count.mockResolvedValue(0);
      await service.updateEstado(
        1,
        { estado: EstadoActividad.COMPLETADA },
        profesional,
      );
      expect(actividadRepo.update).toHaveBeenCalledWith(1, {
        estado: EstadoActividad.COMPLETADA,
      });
    });

    it('remove: rechaza si no es el creador', async () => {
      const otro = { ...profesional, id: 999 };
      await expect(service.remove(1, otro)).rejects.toThrow(ForbiddenException);
    });

    it('remove: el creador puede eliminar', async () => {
      await service.remove(1, profesional);
      expect(actividadRepo.delete).toHaveBeenCalledWith(1);
    });

    describe('update: regeneración de sesiones', () => {
      const ayer = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
      })();
      const inicio = actividad.fechaInicio;

      it('no toca las sesiones si las fechas que llegan son las mismas', async () => {
        await service.update(
          1,
          {
            titulo: 'Nuevo',
            fechaInicio: actividad.fechaInicio,
            fechaFin: actividad.fechaFin,
          },
          profesional,
        );
        expect(managerStub.find).not.toHaveBeenCalled();
        expect(managerStub.delete).not.toHaveBeenCalled();
      });

      it('conserva las pendientes de días pasados y las resueltas, y crea solo las fechas que faltan', async () => {
        managerStub.find.mockResolvedValue([
          { id: 1, fechaProgramada: inicio, estado: EstadoInstancia.REALIZADA },
          { id: 2, fechaProgramada: ayer, estado: EstadoInstancia.PENDIENTE },
        ]);
        const nuevaFechaFin = new Date();
        nuevaFechaFin.setDate(nuevaFechaFin.getDate() + 40);

        await service.update(
          1,
          { fechaFin: nuevaFechaFin.toISOString().slice(0, 10) },
          profesional,
        );

        expect(managerStub.delete).not.toHaveBeenCalled();
        const guardadas = (
          managerStub.save.mock.calls[0][0] as { fechaProgramada: string }[]
        ).map((x) => x.fechaProgramada);
        expect(guardadas).not.toContain(inicio);
        expect(guardadas).not.toContain(ayer);
        expect(guardadas.length).toBeGreaterThan(0);
      });

      it('borra las pendientes que quedan fuera del nuevo calendario', async () => {
        const fuera = new Date();
        fuera.setDate(fuera.getDate() + 19);
        managerStub.find.mockResolvedValue([
          {
            id: 7,
            fechaProgramada: fuera.toISOString().slice(0, 10),
            estado: EstadoInstancia.PENDIENTE,
          },
          {
            id: 8,
            fechaProgramada: fuera.toISOString().slice(0, 10),
            estado: EstadoInstancia.CANCELADA,
          },
        ]);
        const nuevaFechaFin = new Date();
        nuevaFechaFin.setDate(nuevaFechaFin.getDate() + 5);

        await service.update(
          1,
          { fechaFin: nuevaFechaFin.toISOString().slice(0, 10) },
          profesional,
        );

        expect(managerStub.delete).toHaveBeenCalledWith(ActividadInstancia, {
          id: In([7]),
        });
      });

      it('409 si una pendiente que queda fuera tiene un reporte', async () => {
        const fuera = new Date();
        fuera.setDate(fuera.getDate() + 19);
        managerStub.find.mockResolvedValue([
          {
            id: 7,
            fechaProgramada: fuera.toISOString().slice(0, 10),
            estado: EstadoInstancia.PENDIENTE,
          },
        ]);
        managerStub.count.mockResolvedValue(1);
        const nuevaFechaFin = new Date();
        nuevaFechaFin.setDate(nuevaFechaFin.getDate() + 5);

        await expect(
          service.update(
            1,
            { fechaFin: nuevaFechaFin.toISOString().slice(0, 10) },
            profesional,
          ),
        ).rejects.toThrow(ConflictException);
        expect(managerStub.delete).not.toHaveBeenCalled();
      });
    });

    it('update: cambiar terapiaId en una actividad TERAPIA reemplaza el vínculo', async () => {
      actividadRepo.findOne.mockResolvedValue({
        ...actividad,
        tipoActividad: TipoActividad.TERAPIA,
      });
      terapiaRepo.findOne.mockResolvedValue({ id: 7, especialidadId: 5 });
      await service.update(1, { terapiaId: 7 }, profesional);
      expect(managerStub.delete).toHaveBeenCalledWith(expect.anything(), {
        actividadId: 1,
      });
    });

    it('update: cambiar medicamentos en una actividad MEDICAMENTO reemplaza el detalle', async () => {
      actividadRepo.findOne.mockResolvedValue({
        ...actividad,
        tipoActividad: TipoActividad.MEDICAMENTO,
      });
      medicamentoRepo.find.mockResolvedValue([{ id: 3 }]);
      await service.update(
        1,
        { medicamentos: [{ medicamentoId: 3, dosis: '10mg' }] },
        profesional,
      );
      expect(managerStub.save).toHaveBeenCalledWith([
        expect.objectContaining({ medicamentoId: 3 }),
      ]);
    });

    it('un Tutor creador (de una actividad no-TERAPIA) también puede modificar/completar/eliminar la suya', async () => {
      const actividadDeTutor = { ...actividad, creadoPorUserId: tutor.id };
      actividadRepo.findOne.mockResolvedValue(actividadDeTutor);
      instanciaRepo.count.mockResolvedValue(0);

      await service.update(1, { titulo: 'Nuevo título' }, tutor);
      await service.updateEstado(
        1,
        { estado: EstadoActividad.COMPLETADA },
        tutor,
      );
      await service.remove(1, tutor);

      expect(actividadRepo.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('confirmarInstancia', () => {
    const actividadTerapia = {
      id: 1,
      creadoPorUserId: profesional.id,
      pcdId: pcdCaller.id,
      tipoActividad: TipoActividad.TERAPIA,
    };

    it('un Tutor no puede confirmar instancias de una actividad TERAPIA', async () => {
      actividadRepo.findOne.mockResolvedValue(actividadTerapia);
      vinculoAccess.assertVinculoActivo.mockResolvedValue(undefined);
      await expect(service.confirmarInstancia(1, 5, tutor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rechaza confirmar una instancia ya REALIZADA', async () => {
      actividadRepo.findOne.mockResolvedValue({
        ...actividadTerapia,
        tipoActividad: TipoActividad.EJERCICIO,
      });
      instanciaRepo.findOne.mockResolvedValue({
        id: 5,
        actividadId: 1,
        estado: EstadoInstancia.REALIZADA,
      });
      await expect(
        service.confirmarInstancia(1, 5, profesional),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza confirmar una instancia CANCELADA', async () => {
      actividadRepo.findOne.mockResolvedValue({
        ...actividadTerapia,
        tipoActividad: TipoActividad.EJERCICIO,
      });
      instanciaRepo.findOne.mockResolvedValue({
        id: 5,
        actividadId: 1,
        estado: EstadoInstancia.CANCELADA,
      });
      await expect(
        service.confirmarInstancia(1, 5, profesional),
      ).rejects.toThrow(BadRequestException);
    });

    it('confirma una instancia PENDIENTE válida', async () => {
      actividadRepo.findOne.mockResolvedValue({
        ...actividadTerapia,
        tipoActividad: TipoActividad.EJERCICIO,
      });
      instanciaRepo.findOne.mockResolvedValue({
        id: 5,
        actividadId: 1,
        estado: EstadoInstancia.PENDIENTE,
      });
      await service.confirmarInstancia(1, 5, profesional);
      expect(instanciaRepo.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          estado: EstadoInstancia.REALIZADA,
          confirmedByUserId: profesional.id,
        }),
      );
    });
  });

  describe('findInstancias', () => {
    it('devuelve las instancias ordenadas si el caller tiene acceso', async () => {
      actividadRepo.findOne.mockResolvedValue({
        id: 1,
        creadoPorUserId: profesional.id,
        pcdId: pcdCaller.id,
      });
      instanciaRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.findInstancias(1, profesional);
      expect(result).toHaveLength(2);
    });
  });

  describe('findInstanciaOrFail (vía confirmarInstancia)', () => {
    it('404: la instancia no existe', async () => {
      actividadRepo.findOne.mockResolvedValue({
        id: 1,
        creadoPorUserId: profesional.id,
        pcdId: pcdCaller.id,
        tipoActividad: TipoActividad.EJERCICIO,
      });
      instanciaRepo.findOne.mockResolvedValue(null);
      await expect(
        service.confirmarInstancia(1, 999, profesional),
      ).rejects.toThrow(NotFoundException);
    });

    it('404: la instancia existe pero pertenece a otra actividad', async () => {
      actividadRepo.findOne.mockResolvedValue({
        id: 1,
        creadoPorUserId: profesional.id,
        pcdId: pcdCaller.id,
        tipoActividad: TipoActividad.EJERCICIO,
      });
      instanciaRepo.findOne.mockResolvedValue({ id: 5, actividadId: 2 });
      await expect(
        service.confirmarInstancia(1, 5, profesional),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelarInstancia (nuevo en BackendV3 — decisión #4)', () => {
    const actividad = {
      id: 1,
      creadoPorUserId: profesional.id,
      pcdId: pcdCaller.id,
      tipoActividad: TipoActividad.EJERCICIO,
    };

    beforeEach(() => {
      actividadRepo.findOne.mockResolvedValue(actividad);
    });

    it('rechaza a un Profesional con permisos de admin que no es el creador', async () => {
      const profAdmin = { ...profesional, id: 11, esAdministrador: true };
      instanciaRepo.findOne.mockResolvedValue({
        id: 5,
        actividadId: 1,
        estado: EstadoInstancia.PENDIENTE,
      });
      await expect(
        service.cancelarInstancia(1, 5, {}, profAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza si no es el creador', async () => {
      const otro = { ...profesional, id: 999 };
      instanciaRepo.findOne.mockResolvedValue({
        id: 5,
        actividadId: 1,
        estado: EstadoInstancia.PENDIENTE,
      });
      await expect(service.cancelarInstancia(1, 5, {}, otro)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rechaza cancelar una instancia que no está PENDIENTE', async () => {
      instanciaRepo.findOne.mockResolvedValue({
        id: 5,
        actividadId: 1,
        estado: EstadoInstancia.REALIZADA,
      });
      await expect(
        service.cancelarInstancia(1, 5, {}, profesional),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancela una instancia PENDIENTE con motivo', async () => {
      instanciaRepo.findOne.mockResolvedValue({
        id: 5,
        actividadId: 1,
        estado: EstadoInstancia.PENDIENTE,
      });
      await service.cancelarInstancia(
        1,
        5,
        { motivo: 'No pudo asistir' },
        profesional,
      );
      expect(instanciaRepo.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          estado: EstadoInstancia.CANCELADA,
          canceledByUserId: profesional.id,
          motivoCancelacion: 'No pudo asistir',
        }),
      );
    });
  });
});
