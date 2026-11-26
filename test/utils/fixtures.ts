import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { Repository } from 'typeorm';
import { Usuario } from '../../src/users/entities/usuario.entity';
import { Profesional } from '../../src/users/entities/profesional.entity';
import { Tutor } from '../../src/users/entities/tutor.entity';
import { Pcd } from '../../src/users/entities/pcd.entity';
import { Especialidad } from '../../src/especialidades/entities/especialidad.entity';
import { Vinculo } from '../../src/vinculos/entities/vinculo.entity';
import { TutorPcd } from '../../src/vinculos/entities/tutor-pcd.entity';
import { TipoUsuario } from '../../src/common/enums/tipo-usuario.enum';
import { RolProfesionalVinculo } from '../../src/common/enums/rol-profesional-vinculo.enum';
import { EstadoVinculo } from '../../src/common/enums/estado-vinculo.enum';

export const PASSWORD_DEFAULT = 'Test1234!';

interface CrearUsuarioOpts {
  email: string;
  tipoUsuario: TipoUsuario;
  esAdministrador?: boolean;
  dni?: string;
  /** Solo Profesional. Nombre de la especialidad del catálogo (por defecto, Medicina General). */
  especialidad?: string;
}

/**
 * Crea un usuario (+ su perfil de rol: Profesional/Tutor/Pcd) directo por
 * repositorio, sin pasar por la API — más rápido y no depende de que
 * POST /usuarios ya esté probado para poder armar fixtures de otros specs.
 */
export async function crearUsuario(
  app: INestApplication,
  opts: CrearUsuarioOpts,
): Promise<Usuario> {
  const usuarioRepo: Repository<Usuario> = app.get(getRepositoryToken(Usuario));

  const usuario = await usuarioRepo.save(
    usuarioRepo.create({
      dni: opts.dni ?? String(Math.floor(10_000_000 + Math.random() * 8e7)),
      nombre: 'Test',
      apellido: opts.tipoUsuario,
      email: opts.email,
      password: await bcrypt.hash(PASSWORD_DEFAULT, 10),
      fechaNacimiento: '1990-01-01',
      tipoUsuario: opts.tipoUsuario,
      esAdministrador: opts.esAdministrador ?? false,
    }),
  );

  if (opts.tipoUsuario === TipoUsuario.PROFESIONAL) {
    const profesionalRepo: Repository<Profesional> = app.get(
      getRepositoryToken(Profesional),
    );
    const especialidadRepo: Repository<Especialidad> = app.get(
      getRepositoryToken(Especialidad),
    );
    // La migración carga el catálogo; se crea la que no esté.
    const nombre = opts.especialidad ?? 'Medicina General';
    const especialidad =
      (await especialidadRepo.findOne({ where: { nombre } })) ??
      (await especialidadRepo.save(especialidadRepo.create({ nombre })));
    await profesionalRepo.save(
      profesionalRepo.create({
        userId: usuario.id,
        matricula: `MP-${usuario.id}`,
        especialidadId: especialidad.id,
      }),
    );
  }
  if (opts.tipoUsuario === TipoUsuario.TUTOR) {
    const tutorRepo: Repository<Tutor> = app.get(getRepositoryToken(Tutor));
    await tutorRepo.save(tutorRepo.create({ userId: usuario.id }));
  }
  if (opts.tipoUsuario === TipoUsuario.PCD) {
    const pcdRepo: Repository<Pcd> = app.get(getRepositoryToken(Pcd));
    await pcdRepo.save(pcdRepo.create({ userId: usuario.id }));
  }

  return usuario;
}

export async function crearVinculo(
  app: INestApplication,
  pcdId: number,
  profesionalId: number,
  rolProfesional: RolProfesionalVinculo = RolProfesionalVinculo.CABECERA,
  estado: EstadoVinculo = EstadoVinculo.ACTIVO,
): Promise<Vinculo> {
  const vinculoRepo: Repository<Vinculo> = app.get(getRepositoryToken(Vinculo));
  return vinculoRepo.save(
    vinculoRepo.create({ pcdId, profesionalId, rolProfesional, estado }),
  );
}

export async function crearTutorPcd(
  app: INestApplication,
  tutorId: number,
  pcdId: number,
  estado: EstadoVinculo = EstadoVinculo.ACTIVO,
): Promise<TutorPcd> {
  const tutorPcdRepo: Repository<TutorPcd> = app.get(
    getRepositoryToken(TutorPcd),
  );
  return tutorPcdRepo.save(
    tutorPcdRepo.create({ tutorId, pcdId, estado, parentesco: 'Madre' }),
  );
}

/** Login real vía HTTP (ejercita AuthService/JwtStrategy de punta a punta). */
export async function login(
  app: INestApplication,
  email: string,
  password: string = PASSWORD_DEFAULT,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- app.getHttpServer() de supertest no está tipado
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `login falló para ${email}: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return (res.body as { access_token: string }).access_token;
}

export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}
