import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RepositorioSincronizacionPostgres } from '../src/datos/RepositorioSincronizacionPostgres.js';

const crearPool = ({ fallarConsulta, snapshotCursor = '2026-11-22T10:00:00.000Z', recuperadas = 2 } = {}) => {
  const consultas = [];
  const client = {
    async query(sql, parametros = []) {
      consultas.push({ sql: sql.trim(), parametros });
      if (fallarConsulta?.(sql, parametros)) throw new Error('fallo SQL simulado');
      if (sql.includes('SELECT id, nombre')) return { rows: [{ id: 1, nombre: 'redmine' }, { id: 2, nombre: 'glpi' }] };
      if (sql.includes('UPDATE sincronizacion')) return { rowCount: 1, rows: [] };
      return { rowCount: 1, rows: [] };
    },
    release() { consultas.push({ sql: 'RELEASE', parametros: [] }); },
  };
  return {
    consultas,
    async query(sql, parametros) {
      consultas.push({ sql: sql.trim(), parametros });
      if (fallarConsulta?.(sql, parametros)) throw new Error('fallo SQL simulado');
      if (sql.includes('FROM snapshot_fuente')) {
        return { rows: [{ nombre: 'redmine', datos: [{ id: 4 }], fecha: '2026-11-22T10:00:00.000Z', cursor: snapshotCursor, metadatos: [] }] };
      }
      if (sql.includes('UPDATE sincronizacion')) return { rowCount: recuperadas, rows: [] };
      return { rows: [] };
    },
    async connect() { return client; },
    async end() {},
  };
};

const entradaFinal = {
  id: 10,
  fin: '2026-11-22T10:15:00.000Z',
  estado: 'parcial',
  fallos: [{ fuente: 'glpi', fecha: '2026-11-22T10:14:00.000Z', intentos: 3, mensaje: 'error fuente' }],
  snapshots: [{ nombre: 'redmine', datos: [{ id: 4 }], fecha: '2026-11-22T10:13:00.000Z', cursor: '2026-11-22T10:00:00.000Z', metadatos: [] }],
};

describe('RepositorioSincronizacionPostgres', () => {
  it('rehidrata snapshots completos y cursores por fuente', async () => {
    const repositorio = new RepositorioSincronizacionPostgres(crearPool());
    const snapshots = await repositorio.cargarSnapshots();
    assert.deepEqual(snapshots, [{
      nombre: 'redmine', datos: [{ id: 4 }], fecha: '2026-11-22T10:00:00.000Z',
      cursor: '2026-11-22T10:00:00.000Z', metadatos: [],
    }]);
  });

  it('rehidrata cursor null para snapshots de modo mock', async () => {
    const repositorio = new RepositorioSincronizacionPostgres(crearPool({ snapshotCursor: null }));
    const [snapshot] = await repositorio.cargarSnapshots();
    assert.equal(snapshot.cursor, null);
  });

  it('marca como fallidas las sincronizaciones abandonadas sin insertar fallos artificiales', async () => {
    const pool = crearPool({ recuperadas: 3 });
    const repositorio = new RepositorioSincronizacionPostgres(pool);

    const recuperadas = await repositorio.recuperarSincronizacionesAbandonadas();

    assert.equal(recuperadas, 3);
    const consulta = pool.consultas[0].sql;
    assert.match(consulta, /SET estado = 'fallida', fin = NOW\(\)/);
    assert.match(consulta, /WHERE estado = 'en-curso' AND fin IS NULL/);
    assert.equal(pool.consultas.some(({ sql }) => sql.includes('registro_fallo')), false);
  });

  it('propaga el error PostgreSQL al recuperar sincronizaciones abandonadas', async () => {
    const repositorio = new RepositorioSincronizacionPostgres(crearPool({ fallarConsulta: () => true }));

    await assert.rejects(repositorio.recuperarSincronizacionesAbandonadas(), /fallo SQL simulado/);
  });

  it('registra fallos actuales, finaliza la ejecución y confirma snapshots en una transacción', async () => {
    const pool = crearPool();
    const repositorio = new RepositorioSincronizacionPostgres(pool);
    await repositorio.finalizarSincronizacion(entradaFinal);
    const sql = pool.consultas.map((consulta) => consulta.sql);
    assert.equal(sql[0], 'BEGIN');
    assert.ok(sql.some((consulta) => consulta.startsWith('INSERT INTO registro_fallo')));
    assert.ok(sql.some((consulta) => consulta.startsWith('UPDATE sincronizacion')));
    assert.ok(sql.some((consulta) => consulta.startsWith('INSERT INTO snapshot_fuente')));
    assert.equal(sql.at(-2), 'COMMIT');
  });

  it('revierte fallos y snapshots si falla la inserción de un RegistroFallo', async () => {
    const pool = crearPool({ fallarConsulta: (sql) => sql.includes('INSERT INTO registro_fallo') });
    const repositorio = new RepositorioSincronizacionPostgres(pool);
    await assert.rejects(repositorio.finalizarSincronizacion(entradaFinal), /fallo SQL simulado/);
    const sql = pool.consultas.map((consulta) => consulta.sql);
    assert.ok(sql.includes('ROLLBACK'));
    assert.ok(!sql.includes('COMMIT'));
    assert.ok(!sql.some((consulta) => consulta.startsWith('UPDATE sincronizacion')));
    assert.ok(!sql.some((consulta) => consulta.startsWith('INSERT INTO snapshot_fuente')));
  });

  it('revierte la inserción de fallos y snapshots si falla el estado final', async () => {
    const pool = crearPool({ fallarConsulta: (sql) => sql.includes('UPDATE sincronizacion') });
    const repositorio = new RepositorioSincronizacionPostgres(pool);
    await assert.rejects(repositorio.finalizarSincronizacion(entradaFinal), /fallo SQL simulado/);
    const sql = pool.consultas.map((consulta) => consulta.sql);
    assert.ok(sql.some((consulta) => consulta.startsWith('INSERT INTO registro_fallo')));
    assert.ok(sql.includes('ROLLBACK'));
    assert.ok(!sql.includes('COMMIT'));
    assert.ok(!sql.some((consulta) => consulta.startsWith('INSERT INTO snapshot_fuente')));
  });

  it('revierte los fallos y el estado final si falla el upsert del snapshot', async () => {
    const pool = crearPool({ fallarConsulta: (sql) => sql.includes('INSERT INTO snapshot_fuente') });
    const repositorio = new RepositorioSincronizacionPostgres(pool);
    await assert.rejects(repositorio.finalizarSincronizacion(entradaFinal), /fallo SQL simulado/);
    const sql = pool.consultas.map((consulta) => consulta.sql);
    assert.ok(sql.some((consulta) => consulta.startsWith('INSERT INTO registro_fallo')));
    assert.ok(sql.some((consulta) => consulta.startsWith('UPDATE sincronizacion')));
    assert.ok(sql.includes('ROLLBACK'));
    assert.ok(!sql.includes('COMMIT'));
  });
});
