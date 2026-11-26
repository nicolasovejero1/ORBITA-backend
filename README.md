# Trabajo Final: Backend

API REST para la gestión de personas con discapacidad (PCD), sus tutores y los profesionales a cargo: vínculos, medicamentos, terapias, actividades con recurrencia, reportes de progreso, notificaciones (push e in-app), ubicación en vivo y recuperación de contraseña por correo.

## Tecnologías

- **NestJS 11** y **TypeScript**.
- **MySQL 8** con **TypeORM** (migraciones versionadas, sin `synchronize`).
- **JWT** con sesiones propias: refresh token rotado y revocable.
- **socket.io** para la ubicación en vivo.
- **class-validator** para validar las entradas, **helmet**, rate limiting y CORS con lista blanca.
- **Jest** para las pruebas unitarias y e2e.
- **pnpm** como gestor de paquetes.

## Requisitos

- Node.js 22 o superior.
- pnpm (`corepack enable` si no está instalado).
- MySQL 8 en funcionamiento.

## Instalación

### 1. Dependencias

```bash
pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

En `.env` se deben completar los datos del MySQL local (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`) y definir un `JWT_SECRET` propio. `DB_DATABASE` debe ser `bd_backend_v3` si se usa el script de abajo. Las variables `MAIL_USER` y `MAIL_PASS` (cuenta de Gmail con contraseña de aplicación) solo hacen falta para probar la recuperación de contraseña.

### 3. Base de datos

Con el script incluido, que crea la base `bd_backend_v3`, las tablas, el catálogo de especialidades y el registro de migraciones:

```bash
mysql -u root -p < database/crear-base-de-datos.sql
```

Alternativa equivalente: crear una base vacía y ejecutar las migraciones con `pnpm run migration:run`.

### 4. Datos de ejemplo (opcional)

```bash
pnpm run seed
```

Crea un administrador, dos profesionales, un tutor y un PCD con vínculos, actividades y notificaciones. Todos con la contraseña `admin123`:

| Rol | Email |
|---|---|
| Administrador | `admin@pcd.com` |
| Profesional con permisos de administrador | `laura.gomez@pcd.com` |
| Profesional | `profesional@gmail.com` |
| Tutor | `tutor@gmail.com` |
| PCD | `pcd@gmail.com` |

El seed es idempotente: ejecutarlo de nuevo no duplica datos.

## Ejecución

```bash
pnpm run start:dev    # desarrollo, con recarga automática
pnpm run build && pnpm run start:prod
```

La API queda en `http://localhost:3000` (puerto configurable con `PORT`). La documentación interactiva de todos los endpoints (Swagger) está en `http://localhost:3000/api`.

## Pruebas

```bash
pnpm test             # unitarias (no necesitan base de datos)
pnpm run test:cov     # unitarias con cobertura
pnpm run test:e2e     # e2e: usa .env.test y la base bd_app_test
```

Las pruebas e2e necesitan un MySQL local accesible con las credenciales de `.env.test` (por defecto `root` / `root` en `localhost`) y la base de pruebas creada de antemano:

```sql
CREATE DATABASE bd_app_test CHARACTER SET utf8mb4;
```

Antes de cada corrida, `test:e2e` aplica las migraciones y **vacía todas las tablas** de `bd_app_test`. Esa base debe ser exclusiva de las pruebas: nunca se debe apuntar `.env.test` a la base de trabajo.

## Conexión con el frontend

El backend acepta pedidos del frontend web de desarrollo (`http://localhost:8081`) y de Expo (`http://localhost:19006`). Si el frontend corre en otra dirección, se debe agregar a `CORS_ORIGINS` en `.env`. Desde un celular físico, el frontend debe apuntar a la IP de la PC (`http://<IP>:3000`).

## Estructura

```
src/
  auth/            login, sesiones, recuperación de contraseña
  users/           usuarios (Administrador, Profesional, Tutor, PCD) y especialidades
  vinculos/        vínculos profesional-PCD y tutor-PCD
  actividades/     actividades, recurrencia e instancias (sesiones)
  medicamentos/    catálogo de medicamentos
  terapias/        catálogo de terapias
  reportes/        reportes de progreso, colaboradores y adjuntos
  notificaciones/  bandeja, push (Expo) y recordatorios
  ubicaciones/     ubicación compartida, historial y socket en vivo
  common/          enums, filtros de excepciones, utilidades
  migrations/      migraciones de TypeORM
  seed.ts          datos de ejemplo
test/              pruebas e2e
database/          script SQL de creación de la base
```

## Reglas de acceso principales

- El **Administrador** gestiona usuarios, vínculos y catálogos. Puede leer todas las actividades y reportes, pero no los modifica ni ve ubicaciones.
- El **Profesional** y el **Tutor** crean y gestionan **sus propias** actividades; solo el creador las modifica, completa o elimina.
- El **PCD** ve sus actividades y comparte su ubicación solo con quien tenga un vínculo activo.
- Los reportes finalizados son inmutables.
