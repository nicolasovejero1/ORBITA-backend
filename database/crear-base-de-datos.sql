-- ============================================================================
-- Script de creación de la base de datos (MySQL 8) - Sistema de gestión PCD
--
-- Crea la base `bd_backend_v3`, las 21 tablas con sus claves e índices, el
-- catálogo de especialidades y el registro de migraciones de TypeORM, de modo
-- que la aplicación arranque sin volver a ejecutar las migraciones.
--
-- Uso:    mysql -u root -p < database/crear-base-de-datos.sql
-- Luego:  pnpm run seed        (carga usuarios y datos de ejemplo, opcional)
--
-- Si preferís no usar este script, el mismo resultado se obtiene con una base
-- vacía y `pnpm run migration:run`.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS bd_backend_v3 CHARACTER SET utf8mb4;
USE bd_backend_v3;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `actividad_instancias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actividadId` int NOT NULL,
  `fechaProgramada` date NOT NULL,
  `estado` enum('PENDIENTE','REALIZADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  `confirmedAt` datetime DEFAULT NULL,
  `confirmedByUserId` int DEFAULT NULL,
  `canceledAt` datetime DEFAULT NULL,
  `canceledByUserId` int DEFAULT NULL,
  `motivoCancelacion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_ddee2fb52d1b3679010a7532b40` (`actividadId`),
  KEY `FK_2ea5424d51a136338eb132080f6` (`confirmedByUserId`),
  KEY `FK_b3d608d60e106c5fb634227e176` (`canceledByUserId`),
  CONSTRAINT `FK_2ea5424d51a136338eb132080f6` FOREIGN KEY (`confirmedByUserId`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `FK_b3d608d60e106c5fb634227e176` FOREIGN KEY (`canceledByUserId`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `FK_ddee2fb52d1b3679010a7532b40` FOREIGN KEY (`actividadId`) REFERENCES `actividades` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `actividad_medicamentos` (
  `actividadId` int NOT NULL,
  `medicamentoId` int NOT NULL,
  `dosis` varchar(100) DEFAULT NULL,
  `frecuencia` varchar(100) DEFAULT NULL,
  `duracionTratamiento` varchar(100) DEFAULT NULL,
  `indicacion` text,
  `medicoPrescriptor` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`actividadId`,`medicamentoId`),
  KEY `FK_4a05f15eddff08d60b743668605` (`medicamentoId`),
  CONSTRAINT `FK_4a05f15eddff08d60b743668605` FOREIGN KEY (`medicamentoId`) REFERENCES `medicamentos` (`id`),
  CONSTRAINT `FK_4af641ed3a78d3821d1ae66bc0c` FOREIGN KEY (`actividadId`) REFERENCES `actividades` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `actividad_terapias` (
  `actividadId` int NOT NULL,
  `terapiaId` int NOT NULL,
  PRIMARY KEY (`actividadId`),
  KEY `FK_0b667109b6e01f8bdda34d4a2c4` (`terapiaId`),
  CONSTRAINT `FK_0b667109b6e01f8bdda34d4a2c4` FOREIGN KEY (`terapiaId`) REFERENCES `terapias` (`id`),
  CONSTRAINT `FK_262fa0ba142c9a034af520c5397` FOREIGN KEY (`actividadId`) REFERENCES `actividades` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `actividades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titulo` varchar(100) NOT NULL,
  `descripcion` text NOT NULL,
  `fechaInicio` date NOT NULL,
  `fechaFin` date NOT NULL,
  `horarioInicio` time DEFAULT NULL,
  `horarioFin` time DEFAULT NULL,
  `observaciones` text,
  `estado` enum('PENDIENTE','COMPLETADA') NOT NULL DEFAULT 'PENDIENTE',
  `tipoActividad` enum('EJERCICIO','MEDICAMENTO','TERAPIA','PERSONALIZADA') NOT NULL,
  `frecuencia` enum('DIARIA','SEMANAL','DIAS_ESPECIFICOS','MENSUAL') NOT NULL,
  `diasSemana` json DEFAULT NULL,
  `recordarAntesMinutos` int DEFAULT NULL,
  `creadoPorUserId` int NOT NULL,
  `pcdId` int NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_bef5f3e64feff58b7faa3ba2bc7` (`creadoPorUserId`),
  KEY `FK_eccf0ee2ce8e6e36c9b1fc75958` (`pcdId`),
  CONSTRAINT `FK_bef5f3e64feff58b7faa3ba2bc7` FOREIGN KEY (`creadoPorUserId`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `FK_eccf0ee2ce8e6e36c9b1fc75958` FOREIGN KEY (`pcdId`) REFERENCES `pcds` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `especialidades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_especialidades_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicamentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `presentacion` varchar(255) DEFAULT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `descripcion` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `timestamp` bigint NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuarioId` int NOT NULL,
  `tipo` enum('RECORDATORIO','ALERTA','ACTIVIDAD','REPORTE') NOT NULL,
  `mensaje` text NOT NULL,
  `estado` enum('PENDIENTE','ENVIADA','LEIDA') NOT NULL DEFAULT 'PENDIENTE',
  `leidaAt` datetime DEFAULT NULL,
  `actividadId` int DEFAULT NULL,
  `instanciaId` int DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `pcdId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_125b6cc2388b61c1b00c633c673` (`usuarioId`),
  KEY `FK_e91ea890371e06f32eb2162c127` (`actividadId`),
  KEY `FK_413666286f7eb2df90c8ec8ed35` (`instanciaId`),
  KEY `FK_c170ca204c9037a03ad431e102d` (`pcdId`),
  CONSTRAINT `FK_125b6cc2388b61c1b00c633c673` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_413666286f7eb2df90c8ec8ed35` FOREIGN KEY (`instanciaId`) REFERENCES `actividad_instancias` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_c170ca204c9037a03ad431e102d` FOREIGN KEY (`pcdId`) REFERENCES `pcds` (`userId`) ON DELETE SET NULL,
  CONSTRAINT `FK_e91ea890371e06f32eb2162c127` FOREIGN KEY (`actividadId`) REFERENCES `actividades` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_otp` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuarioId` int NOT NULL,
  `codigoHash` char(64) NOT NULL,
  `intentos` int NOT NULL DEFAULT '0',
  `createdAt` datetime NOT NULL,
  `expiresAt` datetime NOT NULL,
  `usadoAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_password_reset_otp_usuario_fecha` (`usuarioId`,`createdAt`),
  CONSTRAINT `FK_password_reset_otp_usuario` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pcds` (
  `userId` int NOT NULL,
  `tipoDiscapacidad` varchar(255) DEFAULT NULL,
  `grado` varchar(10) DEFAULT NULL,
  `diagnostico` text,
  PRIMARY KEY (`userId`),
  CONSTRAINT `FK_7f0412cf4554eab204a9bd3cd81` FOREIGN KEY (`userId`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `profesionales` (
  `userId` int NOT NULL,
  `matricula` varchar(30) NOT NULL,
  `establecimiento` varchar(100) DEFAULT NULL,
  `descripcionFunciones` text,
  `especialidadId` int NOT NULL,
  PRIMARY KEY (`userId`),
  UNIQUE KEY `IDX_44b4d72ab03679b3ac88c16f34` (`matricula`),
  KEY `FK_profesionales_especialidad` (`especialidadId`),
  CONSTRAINT `FK_12425b241c72ad7f616daee7bdd` FOREIGN KEY (`userId`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_profesionales_especialidad` FOREIGN KEY (`especialidadId`) REFERENCES `especialidades` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reporte_adjuntos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reporteId` int NOT NULL,
  `tipoArchivo` enum('PDF','IMAGEN','URL') NOT NULL,
  `filePath` varchar(500) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_6b5fa261454caa933bf4e560915` (`reporteId`),
  CONSTRAINT `FK_6b5fa261454caa933bf4e560915` FOREIGN KEY (`reporteId`) REFERENCES `reportes_progreso` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reporte_colaboradores` (
  `profesionalId` int NOT NULL,
  `reporteId` int NOT NULL,
  `fechaAcceso` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`profesionalId`,`reporteId`),
  KEY `FK_089c79127bf860a3c48c3ee3cf4` (`reporteId`),
  CONSTRAINT `FK_089c79127bf860a3c48c3ee3cf4` FOREIGN KEY (`reporteId`) REFERENCES `reportes_progreso` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_cfddf33e74d4fed2b4dad84be3a` FOREIGN KEY (`profesionalId`) REFERENCES `profesionales` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reportes_progreso` (
  `id` int NOT NULL AUTO_INCREMENT,
  `profesionalId` int NOT NULL,
  `actividadId` int NOT NULL,
  `instanciaId` int DEFAULT NULL,
  `titulo` varchar(100) NOT NULL,
  `descripcionDetallada` text,
  `tipo` enum('DE_ACTIVIDAD','MENSUAL','FINAL') NOT NULL,
  `estado` enum('EN_CURSO','FINALIZADO') NOT NULL DEFAULT 'EN_CURSO',
  `visibilidadTutor` tinyint NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_5823914fc1ab02f35c7e981c10` (`profesionalId`,`instanciaId`),
  KEY `FK_d59bf7705dfc378f62fee646eef` (`actividadId`),
  KEY `FK_840c2fb5fd830a679817b68867b` (`instanciaId`),
  CONSTRAINT `FK_840c2fb5fd830a679817b68867b` FOREIGN KEY (`instanciaId`) REFERENCES `actividad_instancias` (`id`),
  CONSTRAINT `FK_d59bf7705dfc378f62fee646eef` FOREIGN KEY (`actividadId`) REFERENCES `actividades` (`id`),
  CONSTRAINT `FK_dce72fe2d60360a0dccc8abe7f4` FOREIGN KEY (`profesionalId`) REFERENCES `profesionales` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesiones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuarioId` int NOT NULL,
  `tokenHash` char(64) NOT NULL,
  `userAgent` varchar(255) DEFAULT NULL,
  `expiresAt` datetime NOT NULL,
  `revokedAt` datetime DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_a5529fd93e2fea9ce42184a183` (`tokenHash`),
  KEY `FK_1e2e12e2ffd791298d701f2ae55` (`usuarioId`),
  CONSTRAINT `FK_1e2e12e2ffd791298d701f2ae55` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `terapias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo` varchar(50) NOT NULL,
  `descripcion` varchar(255) NOT NULL,
  `especialidadId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_terapias_especialidad` (`especialidadId`),
  CONSTRAINT `FK_terapias_especialidad` FOREIGN KEY (`especialidadId`) REFERENCES `especialidades` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutor_pcd` (
  `tutorId` int NOT NULL,
  `pcdId` int NOT NULL,
  `estado` enum('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `fechaAsignacion` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `parentesco` varchar(30) NOT NULL,
  PRIMARY KEY (`tutorId`,`pcdId`),
  KEY `FK_2fcad10df3ed759a88cb7e4b9cc` (`pcdId`),
  CONSTRAINT `FK_29c2340773a1fcb8380dbb145db` FOREIGN KEY (`tutorId`) REFERENCES `tutores` (`userId`),
  CONSTRAINT `FK_2fcad10df3ed759a88cb7e4b9cc` FOREIGN KEY (`pcdId`) REFERENCES `pcds` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutores` (
  `userId` int NOT NULL,
  PRIMARY KEY (`userId`),
  CONSTRAINT `FK_2c84d25f8b34288d4f52fdcfe94` FOREIGN KEY (`userId`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ubicaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pcdId` int NOT NULL,
  `latitud` decimal(10,8) NOT NULL,
  `longitud` decimal(11,8) NOT NULL,
  `precision` decimal(4,1) DEFAULT NULL,
  `fechaHora` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_ubicaciones_pcd_fecha` (`pcdId`,`fechaHora`),
  CONSTRAINT `FK_e2860522bb66519f64239c5b1d4` FOREIGN KEY (`pcdId`) REFERENCES `pcds` (`userId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ubicaciones_compartidas` (
  `usuarioId` int NOT NULL,
  `pcdId` int NOT NULL,
  `fechaDesde` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`usuarioId`,`pcdId`),
  KEY `FK_ec8b8050b7c6edbc0ecd2b438ba` (`pcdId`),
  CONSTRAINT `FK_ec8b8050b7c6edbc0ecd2b438ba` FOREIGN KEY (`pcdId`) REFERENCES `pcds` (`userId`) ON DELETE CASCADE,
  CONSTRAINT `FK_fc22282710e192b689adf2cc473` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dni` varchar(15) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) NOT NULL,
  `fechaNacimiento` date NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `tipoUsuario` enum('ADMINISTRADOR','PROFESIONAL','TUTOR','PCD') NOT NULL,
  `esAdministrador` tinyint NOT NULL DEFAULT '0',
  `estado` enum('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `pushToken` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_3fd196cb306bed4b2a2e7c3415` (`dni`),
  UNIQUE KEY `IDX_446adfc18b35418aac32ae0b7b` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vinculos` (
  `pcdId` int NOT NULL,
  `profesionalId` int NOT NULL,
  `rolProfesional` enum('CABECERA','ESPECIALISTA') NOT NULL,
  `estado` enum('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `fechaAsignacion` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`pcdId`,`profesionalId`),
  KEY `FK_75cb757560a692b190995afd45b` (`profesionalId`),
  CONSTRAINT `FK_75cb757560a692b190995afd45b` FOREIGN KEY (`profesionalId`) REFERENCES `profesionales` (`userId`),
  CONSTRAINT `FK_b8e833ec9b1ab33fdd877caf34a` FOREIGN KEY (`pcdId`) REFERENCES `pcds` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


-- Datos iniciales: catálogo de especialidades y migraciones aplicadas

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

/*!40000 ALTER TABLE `especialidades` DISABLE KEYS */;
INSERT INTO `especialidades` VALUES (13,'Enfermería');
INSERT INTO `especialidades` VALUES (11,'Fisiatría');
INSERT INTO `especialidades` VALUES (2,'Fonoaudiología');
INSERT INTO `especialidades` VALUES (1,'Kinesiología');
INSERT INTO `especialidades` VALUES (7,'Medicina General');
INSERT INTO `especialidades` VALUES (9,'Neurología');
INSERT INTO `especialidades` VALUES (6,'Nutrición');
INSERT INTO `especialidades` VALUES (14,'Odontología');
INSERT INTO `especialidades` VALUES (15,'Oftalmología');
INSERT INTO `especialidades` VALUES (16,'Otorrinolaringología');
INSERT INTO `especialidades` VALUES (8,'Pediatría');
INSERT INTO `especialidades` VALUES (3,'Psicología');
INSERT INTO `especialidades` VALUES (5,'Psicopedagogía');
INSERT INTO `especialidades` VALUES (10,'Psiquiatría');
INSERT INTO `especialidades` VALUES (4,'Terapia Ocupacional');
INSERT INTO `especialidades` VALUES (12,'Trabajo Social');
/*!40000 ALTER TABLE `especialidades` ENABLE KEYS */;

/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,1789688639248,'InitialSchema1789688639248');
INSERT INTO `migrations` VALUES (2,1789690995047,'CatalogosYActividades1789690995047');
INSERT INTO `migrations` VALUES (3,1789937189786,'Reportes1789937189786');
INSERT INTO `migrations` VALUES (4,1789939361921,'Notificaciones1789939361921');
INSERT INTO `migrations` VALUES (5,1789946817981,'Ubicaciones1789946817981');
INSERT INTO `migrations` VALUES (6,1790000000000,'QuitarEstadoIniciado1790000000000');
INSERT INTO `migrations` VALUES (7,1790100000000,'QuitarZonaSegura1790100000000');
INSERT INTO `migrations` VALUES (8,1790200000000,'Especialidades1790200000000');
INSERT INTO `migrations` VALUES (9,1790300000000,'TipoNotificacion1790300000000');
INSERT INTO `migrations` VALUES (10,1790400000000,'IndiceUbicaciones1790400000000');
INSERT INTO `migrations` VALUES (11,1790500000000,'PasswordResetOtp1790500000000');
INSERT INTO `migrations` VALUES (12,1790600000000,'ParentescoEnVinculo1790600000000');
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

