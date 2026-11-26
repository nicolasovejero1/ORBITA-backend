import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { MulterError } from 'multer';
import { Request, Response } from 'express';

/**
 * Códigos de error nativos de MySQL (mysql2) que nos interesa traducir a HTTP.
 * Reemplaza al mapeo de códigos Prisma (P2002/P2003/P2025) de BackendV2.
 *
 * A diferencia de BackendV2 —que traducía cualquier violación de FK (P2003) a
 * 400— acá se distinguen dos casos:
 *   - ER_NO_REFERENCED_ROW_2 (1452): se intenta crear/actualizar una fila que
 *     referencia un registro padre inexistente -> 400 Bad Request (dato de entrada inválido).
 *   - ER_ROW_IS_REFERENCED_2 (1451): se intenta eliminar/actualizar un registro
 *     que todavía está referenciado por otras filas -> 409 Conflict (más preciso
 *     que el 400 que usaba BackendV2 para el mismo caso).
 */
const MYSQL_DUP_ENTRY = 'ER_DUP_ENTRY';
const MYSQL_ROW_REFERENCED = 'ER_ROW_IS_REFERENCED_2';
const MYSQL_NO_REFERENCED_ROW = 'ER_NO_REFERENCED_ROW_2';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      ...body,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolve(exception: unknown): {
    status: number;
    body: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const body =
        typeof response === 'string'
          ? { message: response }
          : (response as Record<string, unknown>);
      return { status: exception.getStatus(), body };
    }

    /**
     * Sin este mapeo, un archivo que excede `limits.fileSize` en el
     * FileInterceptor caía al bucket genérico de 500 (MulterError no es una
     * HttpException) — un archivo demasiado grande es un error del cliente,
     * no un fallo del servidor.
     */
    if (exception instanceof MulterError) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        return {
          status: HttpStatus.PAYLOAD_TOO_LARGE,
          body: {
            message: 'El archivo supera el tamaño máximo permitido',
            error: 'Payload Too Large',
          },
        };
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        body: { message: exception.message, error: 'Bad Request' },
      };
    }

    if (exception instanceof EntityNotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        body: { message: 'El registro no existe', error: 'Not Found' },
      };
    }

    if (exception instanceof QueryFailedError) {
      const driverError = (
        exception as QueryFailedError & {
          driverError?: { code?: string };
        }
      ).driverError;
      const code = driverError?.code;

      if (code === MYSQL_DUP_ENTRY) {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            message: 'Ya existe un registro con esos datos',
            error: 'Conflict',
          },
        };
      }
      if (code === MYSQL_ROW_REFERENCED) {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            message:
              'No se puede eliminar/modificar: el registro está referenciado por otros datos',
            error: 'Conflict',
          },
        };
      }
      if (code === MYSQL_NO_REFERENCED_ROW) {
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            message: 'Referencia inválida: el registro relacionado no existe',
            error: 'Bad Request',
          },
        };
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          message: 'Error al procesar la solicitud',
          error: 'Bad Request',
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    };
  }
}
