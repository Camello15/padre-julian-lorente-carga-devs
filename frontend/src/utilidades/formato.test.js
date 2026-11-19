import { describe, expect, it } from 'vitest';
import { construirConsulta, formatearFecha, plural, FILTROS_VACIOS } from './formato.js';

describe('construirConsulta', () => {
  it('omite los filtros vacíos', () => {
    expect(construirConsulta(FILTROS_VACIOS)).toBe('');
    expect(construirConsulta({ ...FILTROS_VACIOS, tipo: 'REC', desde: '2026-11-01' })).toBe('?tipo=REC&desde=2026-11-01');
  });
});

describe('formatearFecha', () => {
  it('no corre un día las fechas AAAA-MM-DD', () => {
    expect(formatearFecha('2026-11-30')).toMatch(/30/);
    expect(formatearFecha(null)).toBe('Sin fecha');
  });
});

describe('plural', () => {
  it('usa singular solo para 1', () => {
    expect(plural(1, 'petición', 'peticiones')).toBe('1 petición');
    expect(plural(3, 'petición', 'peticiones')).toBe('3 peticiones');
  });
});
