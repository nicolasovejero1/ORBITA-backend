import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { MulterError } from 'multer';
import { AllExceptionsFilter } from './all-exceptions.filter';

function buildHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { method: 'GET', url: '/test' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('respeta el status/mensaje de una HttpException tal cual', () => {
    const { host, status, json } = buildHost();
    filter.catch(new BadRequestException('dato inválido'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'dato inválido' }),
    );
  });

  it('traduce EntityNotFoundError a 404', () => {
    const { host, status } = buildHost();
    filter.catch(new EntityNotFoundError('Usuario', { id: 1 }), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('ER_DUP_ENTRY -> 409 Conflict', () => {
    const { host, status } = buildHost();
    const error = new QueryFailedError('INSERT ...', [], {
      code: 'ER_DUP_ENTRY',
    } as never);
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('ER_ROW_IS_REFERENCED_2 (no se puede eliminar: referenciado) -> 409 Conflict', () => {
    const { host, status } = buildHost();
    const error = new QueryFailedError('DELETE ...', [], {
      code: 'ER_ROW_IS_REFERENCED_2',
    } as never);
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('ER_NO_REFERENCED_ROW_2 (referencia a un padre inexistente) -> 400 Bad Request', () => {
    const { host, status } = buildHost();
    const error = new QueryFailedError('INSERT ...', [], {
      code: 'ER_NO_REFERENCED_ROW_2',
    } as never);
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('MulterError LIMIT_FILE_SIZE -> 413 Payload Too Large (antes caía en el 500 genérico)', () => {
    const { host, status } = buildHost();
    filter.catch(new MulterError('LIMIT_FILE_SIZE'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
  });

  it('otro MulterError (p.ej. campo inesperado) -> 400 Bad Request', () => {
    const { host, status } = buildHost();
    filter.catch(new MulterError('LIMIT_UNEXPECTED_FILE'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('cualquier otro error no controlado -> 500 Internal Server Error', () => {
    const { host, status } = buildHost();
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
