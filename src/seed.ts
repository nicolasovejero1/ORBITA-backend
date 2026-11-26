import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { Usuario } from './users/entities/usuario.entity';
import { Profesional } from './users/entities/profesional.entity';
import { Tutor } from './users/entities/tutor.entity';
import { Pcd } from './users/entities/pcd.entity';
import { Vinculo } from './vinculos/entities/vinculo.entity';
import { TutorPcd } from './vinculos/entities/tutor-pcd.entity';
import { Medicamento } from './medicamentos/entities/medicamento.entity';
import { Terapia } from './terapias/entities/terapia.entity';
import { Especialidad } from './especialidades/entities/especialidad.entity';
import { Actividad } from './actividades/entities/actividad.entity';
import { ActividadInstancia } from './actividades/entities/actividad-instancia.entity';
import { ActividadMedicamento } from './actividades/entities/actividad-medicamento.entity';
import { ActividadTerapia } from './actividades/entities/actividad-terapia.entity';
import { Notificacion } from './notificaciones/entities/notificacion.entity';
import { Ubicacion } from './ubicaciones/entities/ubicacion.entity';
import { UbicacionCompartida } from './ubicaciones/entities/ubicacion-compartida.entity';
import { TipoUsuario } from './common/enums/tipo-usuario.enum';
import { RolProfesionalVinculo } from './common/enums/rol-profesional-vinculo.enum';
import { TipoActividad } from './common/enums/tipo-actividad.enum';
import { FrecuenciaActividad } from './common/enums/frecuencia-actividad.enum';
import { EstadoNotificacion } from './common/enums/estado-notificacion.enum';
import { TipoNotificacion } from './common/enums/tipo-notificacion.enum';
import {
  formatLocalDate,
  generarInstancias,
  parseTime,
} from './common/utils/date.utils';

const SALT = 10;

/**
 * Fechas relativas a "hoy" (no fijas como en el seed.ts de V2, que quedaba
 * con actividades vencidas apenas pasaba la fecha hardcodeada). Reutiliza
 * `generarInstancias`/`formatLocalDate` de `date.utils.ts` en vez de
 * reimplementar el cálculo de recurrencia como hacía V2 en su propio seed.ts.
 */
function hoyMas(dias: number): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha;
}

async function main() {
  await dataSource.initialize();

  const usuarioRepo = dataSource.getRepository(Usuario);
  const profesionalRepo = dataSource.getRepository(Profesional);
  const tutorRepo = dataSource.getRepository(Tutor);
  const pcdRepo = dataSource.getRepository(Pcd);
  const vinculoRepo = dataSource.getRepository(Vinculo);
  const tutorPcdRepo = dataSource.getRepository(TutorPcd);
  const medicamentoRepo = dataSource.getRepository(Medicamento);
  const terapiaRepo = dataSource.getRepository(Terapia);
  const especialidadRepo = dataSource.getRepository(Especialidad);
  const actividadRepo = dataSource.getRepository(Actividad);
  const instanciaRepo = dataSource.getRepository(ActividadInstancia);
  const actMedicamentoRepo = dataSource.getRepository(ActividadMedicamento);
  const actTerapiaRepo = dataSource.getRepository(ActividadTerapia);
  const notificacionRepo = dataSource.getRepository(Notificacion);
  const ubicacionRepo = dataSource.getRepository(Ubicacion);
  const compartidaRepo = dataSource.getRepository(UbicacionCompartida);

  async function upsertUsuario(data: {
    dni: string;
    nombre: string;
    apellido: string;
    email: string;
    fechaNacimiento: string;
    telefono?: string;
    tipoUsuario: TipoUsuario;
    esAdministrador?: boolean;
  }): Promise<Usuario> {
    const existente = await usuarioRepo.findOne({
      where: { email: data.email },
    });
    if (existente) return existente;
    return usuarioRepo.save(
      usuarioRepo.create({
        ...data,
        password: await bcrypt.hash('admin123', SALT),
        esAdministrador: data.esAdministrador ?? false,
      }),
    );
  }

  const admin = await upsertUsuario({
    dni: '00000001',
    nombre: 'Admin',
    apellido: 'Sistema',
    email: 'admin@pcd.com',
    fechaNacimiento: '1980-01-01',
    tipoUsuario: TipoUsuario.ADMINISTRADOR,
    esAdministrador: true,
  });

  // La migración ya carga el catálogo; acá solo se crea si falta.
  async function especialidadId(nombre: string): Promise<number> {
    const existente = await especialidadRepo.findOne({ where: { nombre } });
    if (existente) return existente.id;
    return (await especialidadRepo.save(especialidadRepo.create({ nombre })))
      .id;
  }

  const laura = await upsertUsuario({
    dni: '28111222',
    nombre: 'Laura',
    apellido: 'Gómez',
    email: 'laura.gomez@pcd.com',
    fechaNacimiento: '1985-03-20',
    telefono: '1144556677',
    tipoUsuario: TipoUsuario.PROFESIONAL,
    esAdministrador: true,
  });
  if (!(await profesionalRepo.findOne({ where: { userId: laura.id } }))) {
    await profesionalRepo.save(
      profesionalRepo.create({
        userId: laura.id,
        matricula: 'MP-55501',
        especialidadId: await especialidadId('Kinesiología'),
      }),
    );
  }

  const carlos = await upsertUsuario({
    dni: '31444555',
    nombre: 'Carlos',
    apellido: 'Martínez',
    email: 'profesional@gmail.com',
    fechaNacimiento: '1990-07-14',
    tipoUsuario: TipoUsuario.PROFESIONAL,
  });
  if (!(await profesionalRepo.findOne({ where: { userId: carlos.id } }))) {
    await profesionalRepo.save(
      profesionalRepo.create({
        userId: carlos.id,
        matricula: 'MP-77802',
        especialidadId: await especialidadId('Fonoaudiología'),
        establecimiento: 'Hospital Central',
      }),
    );
  }

  const maria = await upsertUsuario({
    dni: '25333444',
    nombre: 'María',
    apellido: 'López',
    email: 'tutor@gmail.com',
    fechaNacimiento: '1975-11-08',
    telefono: '1155667788',
    tipoUsuario: TipoUsuario.TUTOR,
  });
  if (!(await tutorRepo.findOne({ where: { userId: maria.id } }))) {
    await tutorRepo.save(tutorRepo.create({ userId: maria.id }));
  }

  const tomas = await upsertUsuario({
    dni: '45999888',
    nombre: 'Tomás',
    apellido: 'Fernández',
    email: 'pcd@gmail.com',
    fechaNacimiento: '2010-06-01',
    tipoUsuario: TipoUsuario.PCD,
  });
  if (!(await pcdRepo.findOne({ where: { userId: tomas.id } }))) {
    await pcdRepo.save(
      pcdRepo.create({
        userId: tomas.id,
        tipoDiscapacidad: 'Motriz',
        grado: 'Moderado',
        diagnostico: 'Parálisis cerebral leve',
      }),
    );
  }

  if (
    !(await vinculoRepo.findOne({
      where: { pcdId: tomas.id, profesionalId: laura.id },
    }))
  ) {
    await vinculoRepo.save(
      vinculoRepo.create({
        pcdId: tomas.id,
        profesionalId: laura.id,
        rolProfesional: RolProfesionalVinculo.CABECERA,
      }),
    );
  }
  if (
    !(await vinculoRepo.findOne({
      where: { pcdId: tomas.id, profesionalId: carlos.id },
    }))
  ) {
    await vinculoRepo.save(
      vinculoRepo.create({
        pcdId: tomas.id,
        profesionalId: carlos.id,
        rolProfesional: RolProfesionalVinculo.ESPECIALISTA,
      }),
    );
  }
  if (
    !(await tutorPcdRepo.findOne({
      where: { tutorId: maria.id, pcdId: tomas.id },
    }))
  ) {
    await tutorPcdRepo.save(
      tutorPcdRepo.create({
        tutorId: maria.id,
        pcdId: tomas.id,
        parentesco: 'Madre',
      }),
    );
  }

  if (!(await ubicacionRepo.findOne({ where: { pcdId: tomas.id } }))) {
    await ubicacionRepo.save(
      ubicacionRepo.create({
        pcdId: tomas.id,
        latitud: '-34.60372200',
        longitud: '-58.38159200',
        precision: '15.0',
      }),
    );
  }
  for (const usuarioId of [maria.id, laura.id]) {
    if (
      !(await compartidaRepo.findOne({
        where: { usuarioId, pcdId: tomas.id },
      }))
    ) {
      await compartidaRepo.save(
        compartidaRepo.create({ usuarioId, pcdId: tomas.id }),
      );
    }
  }

  async function upsertMedicamento(data: {
    nombre: string;
    presentacion: string;
    tipo: string;
    descripcion: string;
  }): Promise<Medicamento> {
    const existente = await medicamentoRepo.findOne({
      where: { nombre: data.nombre },
    });
    if (existente) return existente;
    return medicamentoRepo.save(medicamentoRepo.create(data));
  }

  const ibuprofeno = await upsertMedicamento({
    nombre: 'Ibuprofeno',
    presentacion: 'Comprimidos 400mg',
    tipo: 'Antiinflamatorio',
    descripcion: 'AINE de uso común',
  });
  const omeprazol = await upsertMedicamento({
    nombre: 'Omeprazol',
    presentacion: 'Cápsulas 20mg',
    tipo: 'Protector gástrico',
    descripcion: 'Inhibidor de bomba de protones',
  });

  async function upsertTerapia(data: {
    tipo: string;
    descripcion: string;
    especialidad: string;
  }): Promise<Terapia> {
    const { especialidad, ...resto } = data;
    const existente = await terapiaRepo.findOne({
      where: { tipo: data.tipo },
    });
    if (existente) return existente;
    return terapiaRepo.save(
      terapiaRepo.create({
        ...resto,
        especialidadId: await especialidadId(especialidad),
      }),
    );
  }

  const kinesiologia = await upsertTerapia({
    tipo: 'Kinesiología',
    descripcion: 'Rehabilitación motriz mediante ejercicios guiados',
    especialidad: 'Kinesiología',
  });
  await upsertTerapia({
    tipo: 'Fonoaudiología',
    descripcion: 'Tratamiento de trastornos del habla y lenguaje',
    especialidad: 'Fonoaudiología',
  });

  async function crearActividadConInstancias(datos: {
    titulo: string;
    descripcion: string;
    fechaInicio: Date;
    fechaFin: Date;
    horarioInicio: string;
    horarioFin?: string;
    tipoActividad: TipoActividad;
    frecuencia: FrecuenciaActividad;
    diasSemana?: string[];
    recordarAntesMinutos?: number;
    observaciones?: string;
  }): Promise<Actividad> {
    const existente = await actividadRepo.findOne({
      where: { titulo: datos.titulo, pcdId: tomas.id },
    });
    if (existente) return existente;

    const actividad = await actividadRepo.save(
      actividadRepo.create({
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        fechaInicio: formatLocalDate(datos.fechaInicio),
        fechaFin: formatLocalDate(datos.fechaFin),
        horarioInicio: parseTime(datos.horarioInicio)
          .toTimeString()
          .slice(0, 8),
        horarioFin: datos.horarioFin
          ? parseTime(datos.horarioFin).toTimeString().slice(0, 8)
          : null,
        tipoActividad: datos.tipoActividad,
        frecuencia: datos.frecuencia,
        diasSemana: datos.diasSemana ?? null,
        recordarAntesMinutos: datos.recordarAntesMinutos ?? null,
        observaciones: datos.observaciones ?? null,
        creadoPorUserId: laura.id,
        pcdId: tomas.id,
      }),
    );

    const instancias = generarInstancias(
      datos.fechaInicio,
      datos.fechaFin,
      datos.frecuencia,
      datos.diasSemana,
    );
    await instanciaRepo.save(
      instancias.map((fecha) =>
        instanciaRepo.create({
          actividadId: actividad.id,
          fechaProgramada: formatLocalDate(fecha),
        }),
      ),
    );

    return actividad;
  }

  const ejercicio = await crearActividadConInstancias({
    titulo: 'Ejercicios de rehabilitación',
    descripcion:
      'Serie de ejercicios para mejorar la movilidad del miembro inferior',
    fechaInicio: hoyMas(-7),
    fechaFin: hoyMas(23),
    horarioInicio: '09:00',
    horarioFin: '09:30',
    tipoActividad: TipoActividad.EJERCICIO,
    frecuencia: FrecuenciaActividad.DIAS_ESPECIFICOS,
    diasSemana: ['LUNES', 'MIERCOLES', 'VIERNES'],
    recordarAntesMinutos: 30,
  });

  const medicamentoActividad = await crearActividadConInstancias({
    titulo: 'Tratamiento antiinflamatorio',
    descripcion: 'Administración de medicación indicada por el médico',
    fechaInicio: hoyMas(-3),
    fechaFin: hoyMas(27),
    horarioInicio: '08:00',
    tipoActividad: TipoActividad.MEDICAMENTO,
    frecuencia: FrecuenciaActividad.DIARIA,
    recordarAntesMinutos: 30,
  });
  if (
    !(await actMedicamentoRepo.findOne({
      where: {
        actividadId: medicamentoActividad.id,
        medicamentoId: ibuprofeno.id,
      },
    }))
  ) {
    await actMedicamentoRepo.save(
      actMedicamentoRepo.create([
        {
          actividadId: medicamentoActividad.id,
          medicamentoId: ibuprofeno.id,
          dosis: '400mg',
          frecuencia: 'Cada 8 horas',
          indicacion: 'Tomar con alimentos',
          medicoPrescriptor: 'Dr. Pérez',
        },
        {
          actividadId: medicamentoActividad.id,
          medicamentoId: omeprazol.id,
          dosis: '20mg',
          frecuencia: 'Una vez al día',
          indicacion: 'En ayunas',
        },
      ]),
    );
  }

  const terapiaActividad = await crearActividadConInstancias({
    titulo: 'Sesión de kinesiología',
    descripcion: 'Sesiones semanales de rehabilitación motriz',
    fechaInicio: hoyMas(-1),
    fechaFin: hoyMas(60),
    horarioInicio: '10:00',
    horarioFin: '11:00',
    tipoActividad: TipoActividad.TERAPIA,
    frecuencia: FrecuenciaActividad.SEMANAL,
    recordarAntesMinutos: 60,
    observaciones:
      'Trabajar principalmente movilidad del miembro inferior izquierdo',
  });
  if (
    !(await actTerapiaRepo.findOne({
      where: { actividadId: terapiaActividad.id },
    }))
  ) {
    await actTerapiaRepo.save(
      actTerapiaRepo.create({
        actividadId: terapiaActividad.id,
        terapiaId: kinesiologia.id,
      }),
    );
  }

  const notificacionesDemo: {
    usuarioId: number;
    tipo: TipoNotificacion;
    mensaje: string;
    actividadId?: number;
    pcdId?: number;
  }[] = [
    {
      usuarioId: tomas.id,
      tipo: TipoNotificacion.ACTIVIDAD,
      mensaje:
        'Tenés "Sesión de kinesiología" programada para hoy. ¡No te la pierdas!',
      actividadId: terapiaActividad.id,
    },
    {
      usuarioId: tomas.id,
      tipo: TipoNotificacion.ACTIVIDAD,
      mensaje: 'Recordatorio: tomá tu medicación de la mañana.',
      actividadId: medicamentoActividad.id,
    },
    {
      usuarioId: maria.id,
      tipo: TipoNotificacion.ACTIVIDAD,
      mensaje: 'Tomás completó "Ejercicios de rehabilitación".',
      actividadId: ejercicio.id,
    },
    {
      usuarioId: laura.id,
      tipo: TipoNotificacion.REPORTE,
      mensaje: 'Se creó un nuevo reporte para revisión.',
    },
    {
      usuarioId: carlos.id,
      tipo: TipoNotificacion.ACTIVIDAD,
      mensaje: 'Recordatorio: hoy tenés sesión de kinesiología con Tomás.',
      actividadId: terapiaActividad.id,
    },
  ];

  for (const n of notificacionesDemo) {
    const existe = await notificacionRepo.findOne({
      where: {
        usuarioId: n.usuarioId,
        tipo: n.tipo,
        mensaje: n.mensaje,
      },
    });
    if (!existe) {
      await notificacionRepo.save(
        notificacionRepo.create({ ...n, estado: EstadoNotificacion.ENVIADA }),
      );
    }
  }

  console.log('✔ Seed completado. Usuarios de prueba (password: admin123):');
  console.log(`  Admin        -> ${admin.email}`);
  console.log(`  Profesional  -> ${laura.email} (CABECERA de Tomás)`);
  console.log(`  Profesional  -> ${carlos.email} (ESPECIALISTA de Tomás)`);
  console.log(`  Tutor        -> ${maria.email} (de Tomás)`);
  console.log(`  PCD          -> ${tomas.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void dataSource.destroy();
  });
