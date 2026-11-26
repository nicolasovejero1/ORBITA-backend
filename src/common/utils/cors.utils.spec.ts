import { parseCorsOrigins } from './cors.utils';

describe('parseCorsOrigins', () => {
  it('sin CORS_ORIGINS definido, usa los defaults de desarrollo', () => {
    expect(parseCorsOrigins(undefined)).toEqual([
      'http://localhost:8081',
      'http://localhost:19006',
      'http://localhost:3010',
    ]);
  });

  it('separa por comas y recorta espacios', () => {
    expect(
      parseCorsOrigins(' https://app.com , https://admin.app.com '),
    ).toEqual(['https://app.com', 'https://admin.app.com']);
  });

  it('ignora entradas vacías (comas de más, trailing comma)', () => {
    expect(parseCorsOrigins('https://app.com,,')).toEqual(['https://app.com']);
  });

  it('un solo origen configurado deja la whitelist con un único elemento', () => {
    expect(parseCorsOrigins('https://app.com')).toEqual(['https://app.com']);
  });
});
