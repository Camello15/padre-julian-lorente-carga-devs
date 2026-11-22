import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { crearConectores } from '../src/conectores/index.js';
import { AlmacenMemoria } from '../src/datos/almacen.js';
import { Sincronizacion } from '../src/sincronizacion/Sincronizacion.js';

const desarrolladores = JSON.parse(readFileSync(new URL('../mocks/desarrolladores.json', import.meta.url), 'utf8'));

const sincronizar = (almacen) =>
  new Sincronizacion({ conectores: crearConectores(), almacen, desarrolladores, umbral: { maxPeticiones: 6 }, esperaReintentoMs: 0 }).ejecutar();

describe('Registros no reconocidos (CU-11)', () => {
  it('un registro revisado no vuelve a aparecer después de sincronizar', async () => {
    const almacen = new AlmacenMemoria();
    await sincronizar(almacen);
    const pendientes = almacen.listarRegistrosNoReconocidos();
    assert.ok(pendientes.length > 1);

    const [primero] = pendientes;
    almacen.marcarRegistroNoReconocido(primero.id, 'POA-001');
    await sincronizar(almacen);

    const despues = almacen.listarRegistrosNoReconocidos();
    assert.equal(despues.length, pendientes.length - 1);
    assert.ok(despues.every((r) => r.id !== primero.id));

    const revisado = almacen.listarRegistrosNoReconocidos({ incluirRevisados: true }).find((r) => r.id === primero.id);
    assert.equal(revisado.revisado, true);
    assert.equal(revisado.peticionAsignada, 'POA-001');
    assert.equal(almacen.estadoSincronizacion.registrosNoReconocidos, pendientes.length - 1);
  });

  it('los ids son estables entre sincronizaciones y únicos', async () => {
    const almacen = new AlmacenMemoria();
    await sincronizar(almacen);
    const ids = almacen.registrosNoReconocidos.map((r) => r.id);
    await sincronizar(almacen);
    assert.deepEqual(almacen.registrosNoReconocidos.map((r) => r.id), ids);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('distingue registros repetidos con la misma fuente y código', () => {
    const almacen = new AlmacenMemoria();
    const registro = { fuente: 'gitlab', codigoOriginal: 'feature/sin-codigo', motivo: 'x', revisado: false };
    almacen.guardarResultado({ registrosNoReconocidos: [registro, { ...registro }] });
    assert.deepEqual(almacen.registrosNoReconocidos.map((r) => r.id), ['gitlab:feature/sin-codigo', 'gitlab:feature/sin-codigo#2']);
  });
});
