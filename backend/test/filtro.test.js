import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Rol } from '../src/auth/roles.js';
import { aplicarRestriccionRol, crearFiltro, filtrarPeticiones, FiltroInvalidoError } from '../src/datos/filtro.js';

const peticiones = [
  { codigo: 'POA-2026-001', desarrolladorId: 'd01', proyectoId: 'banca-movil', tipo: 'POA', modulosCore: ['Captaciones'], fechaInicio: '2026-08-01', fechaFin: '2026-12-18' },
  { codigo: 'REC-2026-011', desarrolladorId: 'd02', proyectoId: 'reportes-control', tipo: 'REC', modulosCore: ['Créditos'], fechaInicio: '2026-10-06', fechaFin: '2026-12-12' },
  { codigo: 'INC-2026-028', desarrolladorId: 'd02', proyectoId: 'reportes-control', tipo: 'INCIDENTE', modulosCore: [], fechaInicio: '2026-11-02', fechaFin: '2026-11-14' },
];

const tecnico = { desarrolladorId: 'd01', rol: Rol.TECNICO };
const pmo = { rol: Rol.PMO };

describe('Filtro por rol (CU-02)', () => {
  it('el Técnico solo ve su propia carga aunque pida otro desarrollador', () => {
    const filtro = aplicarRestriccionRol(crearFiltro({ desarrollador: 'd02' }), tecnico);
    assert.equal(filtro.desarrolladorId, 'd01');
    assert.deepEqual(filtrarPeticiones(peticiones, filtro).map((p) => p.codigo), ['POA-2026-001']);
  });

  it('el Técnico sin filtro también queda limitado a sí mismo', () => {
    const filtro = aplicarRestriccionRol(crearFiltro({}), tecnico);
    assert.equal(filtrarPeticiones(peticiones, filtro).length, 1);
  });

  it('la PMO puede ver a todos o elegir un desarrollador', () => {
    assert.equal(filtrarPeticiones(peticiones, aplicarRestriccionRol(crearFiltro({}), pmo)).length, 3);
    const filtro = aplicarRestriccionRol(crearFiltro({ desarrollador: 'd02' }), pmo);
    assert.equal(filtrarPeticiones(peticiones, filtro).length, 2);
  });
});

describe('Filtros de RF-11', () => {
  it('combina tipo, proyecto y módulo', () => {
    const filtro = crearFiltro({ tipo: 'REC', proyecto: 'reportes-control', modulo: 'Créditos' });
    assert.deepEqual(filtrarPeticiones(peticiones, filtro).map((p) => p.codigo), ['REC-2026-011']);
  });

  it('filtra por rango de fechas según el periodo planificado', () => {
    const filtro = crearFiltro({ desde: '2026-11-15', hasta: '2026-11-30' });
    assert.deepEqual(filtrarPeticiones(peticiones, filtro).map((p) => p.codigo), ['POA-2026-001', 'REC-2026-011']);
  });

  it('rechaza valores inválidos', () => {
    assert.throws(() => crearFiltro({ tipo: 'TAREA' }), FiltroInvalidoError);
    assert.throws(() => crearFiltro({ desde: '19/11/2026' }), FiltroInvalidoError);
    assert.throws(() => crearFiltro({ desde: '2026-12-01', hasta: '2026-11-01' }), FiltroInvalidoError);
  });
});
