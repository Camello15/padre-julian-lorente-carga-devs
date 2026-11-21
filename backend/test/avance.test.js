import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AVANCE_POR_ETAPA_PROPUESTO, avancePromedio, calcularAvance, cargarTablaAvance } from '../src/datos/avance.js';
import { Etapa } from '../src/datos/constantes.js';

describe('calcularAvance (RF-08)', () => {
  it('devuelve el porcentaje propuesto para cada etapa', () => {
    const tabla = AVANCE_POR_ETAPA_PROPUESTO;
    assert.equal(calcularAvance(Etapa.ANALISIS, tabla), 10);
    assert.equal(calcularAvance(Etapa.DESARROLLO, tabla), 40);
    assert.equal(calcularAvance(Etapa.CERTIFICACION, tabla), 70);
    assert.equal(calcularAvance(Etapa.DESPLIEGUE, tabla), 90);
    assert.equal(calcularAvance(Etapa.ESTABILIZACION, tabla), 100);
  });

  it('el avance crece con cada etapa', () => {
    const valores = Object.values(Etapa).map((e) => calcularAvance(e, AVANCE_POR_ETAPA_PROPUESTO));
    assert.deepEqual(valores, [...valores].sort((a, b) => a - b));
  });

  it('rechaza una etapa desconocida', () => {
    assert.throws(() => calcularAvance('PRODUCCION', AVANCE_POR_ETAPA_PROPUESTO), RangeError);
  });

  it('permite configurar los porcentajes con AVANCE_POR_ETAPA', () => {
    const tabla = cargarTablaAvance('{"ANALISIS":5,"DESARROLLO":30,"CERTIFICACION":60,"DESPLIEGUE":85,"ESTABILIZACION":100}');
    assert.equal(calcularAvance(Etapa.DESARROLLO, tabla), 30);
    assert.throws(() => cargarTablaAvance('{"ANALISIS":5}'), /DESARROLLO/);
  });

  it('calcula el avance promedio redondeado', () => {
    assert.equal(avancePromedio([{ avance: 10 }, { avance: 40 }, { avance: 70 }]), 40);
    assert.equal(avancePromedio([]), 0);
  });
});
