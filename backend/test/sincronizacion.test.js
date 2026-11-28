import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { Conector } from '../src/conectores/Conector.js';
import { crearConectores } from '../src/conectores/index.js';
import { AlmacenMemoria } from '../src/datos/almacen.js';
import { extraerCodigo, unificar } from '../src/sincronizacion/normalizador.js';
import { Sincronizacion } from '../src/sincronizacion/Sincronizacion.js';

const desarrolladores = [{ id: 'd01', nombre: 'Persona Uno', idRedmine: 11, usuarioGitlab: 'puno', usuarioGlpi: 'puno' }];
const ejecutarScriptAislado = (script) => {
  const env = { ...process.env, USAR_MOCKS: 'false', ROCKETCHAT_URL: 'https://rocket.example.test', ROCKETCHAT_USER_ID: 'user-id', ROCKETCHAT_TOKEN: 'token' };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env,
  });
};
const issue = (codigo, etapa = 'Desarrollo') => ({
  id: 1, subject: 'Prueba', tracker: { name: 'Incidente' }, status: { is_closed: false },
  assigned_to: { id: 11 }, project: { identifier: 'soporte', name: 'Soporte' },
  custom_fields: [{ name: 'Código', value: codigo }, { name: 'Etapa', value: etapa }, { name: 'Módulo del core', value: ['Cajas'] }],
});

class ConectorFalso extends Conector {
  constructor(nombre, respuestas) { super({ nombre, urlApi: '', activa: true }); this.respuestas = respuestas; this.llamadas = 0; this.desdes = []; }
  async leerDatos(desde, desarrolladores) {
    this.desdes.push(desde);
    if (desarrolladores) this.desarrolladoresRecibidos = desarrolladores;
    const r = this.respuestas[Math.min(this.llamadas++, this.respuestas.length - 1)];
    if (r instanceof Error) throw r;
    return r;
  }
}

describe('Conector', () => {
  it('es abstracto', () => {
    assert.throws(() => new Conector({ nombre: 'x' }), TypeError);
  });
});

describe('Cruce por código (CU-07)', () => {
  it('reconoce los cuatro formatos de código', () => {
    assert.equal(extraerCodigo('feature/POA-2026-001-x'), 'POA-2026-001');
    assert.equal(extraerCodigo('[inc-2026-031] error'), 'INC-2026-031');
    assert.equal(extraerCodigo('feature/iniciativa.ti.001'), 'iniciativa.ti.001');
    assert.equal(extraerCodigo('feature/arreglo-rapido'), null);
  });

  it('une GLPI con RedMine sin duplicar y separa lo no reconocido', () => {
    const r = unificar({
      redmine: [issue('INC-2026-031'), issue('INC-2026-031'), issue('')],
      glpi: [{ id: 9, name: '[INC-2026-031] x', tecnico_asignado: 'puno' }, { id: 10, name: 'sin código' }],
      gitlab: [{ tipo: 'commit', rama: 'hotfix/INC-2026-031', autor: 'puno', fecha: '2026-11-19' }],
    }, desarrolladores);
    assert.equal(r.peticiones.length, 1);
    assert.deepEqual(r.peticiones[0].fuentes, ['redmine', 'glpi', 'gitlab']);
    assert.equal(r.peticiones[0].avance, 40);
    assert.deepEqual(r.modulosConCambios, ['Cajas']);
    assert.equal(r.registrosNoReconocidos.length, 2);
  });
});

describe('Sincronización (RNF-01)', () => {
  const crear = (conectores, almacen = new AlmacenMemoria()) =>
    new Sincronizacion({ conectores, almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0 });

  it('reintenta hasta 3 veces antes de dar por fallida una fuente', async () => {
    const redmine = new ConectorFalso('redmine', [new Error('caída'), new Error('caída'), [issue('INC-2026-031')]]);
    const estado = await crear([redmine]).ejecutar();
    assert.equal(redmine.llamadas, 3);
    assert.equal(estado.estado, 'ok');
  });

  it('si una fuente falla tras 3 intentos usa sus últimos datos y registra el fallo', async () => {
    const almacen = new AlmacenMemoria();
    const redmine = new ConectorFalso('redmine', [[issue('INC-2026-031')], new Error('caída')]);
    const sync = crear([redmine], almacen);
    await sync.ejecutar();
    const estado = await sync.ejecutar();

    assert.equal(redmine.llamadas, 4);
    assert.equal(estado.estado, 'fallida');
    assert.equal(estado.fuentes[0].estado, 'con-datos-anteriores');
    assert.equal(estado.fallos[0].intentos, 3);
    assert.equal(almacen.peticiones.length, 1);
    assert.equal(almacen.alertas.length, 1);
  });

  it('la fábrica asigna a Redmine el nombre usado por la sincronización incremental', () => {
    const conectores = crearConectores({
      redmine: { url: 'https://redmine.test' },
      gitlab: { url: '' },
      glpi: { url: '' },
      rocketchat: { url: '' },
    });
    assert.equal(conectores[0].fuente.nombre, 'redmine');
  });

  it('lee Redmine completo la primera vez y combina incrementos por ID para entregar snapshot completo', async () => {
    let ahora = new Date('2026-11-22T10:00:00.000Z');
    const almacen = new AlmacenMemoria();
    const redmine = new ConectorFalso('redmine', [
      [issue('INC-2026-031'), { ...issue('INC-2026-032'), id: 2 }],
      [{ ...issue('INC-2026-031'), id: 1, subject: 'Actualizada' }, { ...issue('INC-2026-033'), id: 3 }],
    ]);
    const sync = new Sincronizacion({ conectores: [redmine], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, reloj: () => new Date(ahora) });

    await sync.ejecutar();
    const cursorInicial = almacen.cursorFuente('redmine');
    ahora = new Date('2026-11-22T10:10:00.000Z');
    await sync.ejecutar();

    assert.equal(redmine.desdes[0], null);
    assert.equal(redmine.desdes[1].toISOString(), '2026-11-22T09:55:00.000Z');
    const snapshot = almacen.ultimosDatosFuente('redmine').datos;
    assert.equal(snapshot.length, 3);
    assert.equal(snapshot.filter((registro) => registro.id === 1).length, 1);
    assert.equal(snapshot.find((registro) => registro.id === 1).subject, 'Actualizada');
    assert.equal(almacen.cursorFuente('redmine'), '2026-11-22T10:10:00.000Z');
    assert.notEqual(almacen.cursorFuente('redmine'), cursorInicial);
    assert.equal(almacen.peticiones.length, 3);
    assert.deepEqual(almacen.peticiones.map((peticion) => peticion.codigo).sort(), [
      'INC-2026-031', 'INC-2026-032', 'INC-2026-033',
    ]);
  });

  it('si falla la lectura incremental conserva snapshot y cursor previos y luego se recupera', async () => {
    let ahora = new Date('2026-11-22T10:00:00.000Z');
    const almacen = new AlmacenMemoria();
    const redmine = new ConectorFalso('redmine', [
      [issue('INC-2026-031')],
      new Error('fallo de página'),
      new Error('fallo de página'),
      new Error('fallo de página'),
      [{ ...issue('INC-2026-032'), id: 2 }],
    ]);
    const sync = new Sincronizacion({ conectores: [redmine], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, reloj: () => new Date(ahora) });
    await sync.ejecutar();
    const snapshotAnterior = almacen.ultimosDatosFuente('redmine').datos;
    const cursorAnterior = almacen.cursorFuente('redmine');
    ahora = new Date('2026-11-22T10:10:00.000Z');

    const estado = await sync.ejecutar();

    assert.equal(estado.estado, 'fallida');
    assert.equal(almacen.cursorFuente('redmine'), cursorAnterior);
    assert.deepEqual(almacen.ultimosDatosFuente('redmine').datos, snapshotAnterior);
    assert.equal(almacen.peticiones.length, 1);

    ahora = new Date('2026-11-22T10:20:00.000Z');
    await sync.ejecutar();
    assert.equal(almacen.cursorFuente('redmine'), '2026-11-22T10:20:00.000Z');
    assert.equal(almacen.ultimosDatosFuente('redmine').datos.length, 2);
    assert.equal(almacen.peticiones.length, 2);
  });

  it('confirma el cursor tomado al inicio aunque la lectura tarde más de cinco minutos', async () => {
    let ahora = new Date('2026-11-22T10:00:00.000Z');
    const almacen = new AlmacenMemoria();
    const primeraLectura = new ConectorFalso('redmine', [[issue('INC-2026-031')]]);
    const sync = new Sincronizacion({ conectores: [primeraLectura], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, reloj: () => new Date(ahora) });
    await sync.ejecutar();

    const cursorDeInicio = new Date('2026-11-22T10:10:00.000Z');
    ahora = new Date(cursorDeInicio);
    const lecturaLenta = new ConectorFalso('redmine', [[{ ...issue('INC-2026-032'), id: 2 }]]);
    lecturaLenta.leerDatos = async function (desde) {
      this.desdes.push(desde);
      ahora = new Date('2026-11-22T10:16:00.000Z');
      return this.respuestas[0];
    };
    sync.conectores = [lecturaLenta];

    await sync.ejecutar();

    assert.equal(lecturaLenta.desdes[0].toISOString(), '2026-11-22T09:55:00.000Z');
    assert.equal(almacen.cursorFuente('redmine'), cursorDeInicio.toISOString());
    assert.equal(almacen.ultimosDatosFuente('redmine').fecha, '2026-11-22T10:16:00.000Z');
    assert.equal(almacen.ultimosDatosFuente('redmine').datos.length, 2);
  });

  it('si falla la combinación del delta no confirma snapshot ni cursor', async () => {
    let ahora = new Date('2026-11-22T10:00:00.000Z');
    const almacen = new AlmacenMemoria();
    const redmine = new ConectorFalso('redmine', [[issue('INC-2026-031')], [{ subject: 'sin id' }]]);
    const sync = new Sincronizacion({ conectores: [redmine], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, reloj: () => new Date(ahora) });
    await sync.ejecutar();
    const cursorAnterior = almacen.cursorFuente('redmine');
    const snapshotAnterior = almacen.ultimosDatosFuente('redmine').datos;
    ahora = new Date('2026-11-22T10:10:00.000Z');

    const estado = await sync.ejecutar();

    assert.equal(estado.estado, 'fallida');
    assert.equal(almacen.cursorFuente('redmine'), cursorAnterior);
    assert.deepEqual(almacen.ultimosDatosFuente('redmine').datos, snapshotAnterior);
  });

  it('si falla el procesamiento posterior conserva snapshot y cursor para la siguiente recuperación', async () => {
    let ahora = new Date('2026-11-22T10:00:00.000Z');
    const almacen = new AlmacenMemoria();
    const redmine = new ConectorFalso('redmine', [
      [issue('INC-2026-031')],
      [{ ...issue('INC-2026-032'), id: 2 }],
    ]);
    const sync = new Sincronizacion({ conectores: [redmine], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, reloj: () => new Date(ahora) });
    await sync.ejecutar();
    const cursorAnterior = almacen.cursorFuente('redmine');
    const snapshotAnterior = almacen.ultimosDatosFuente('redmine').datos;
    const guardarResultadoOriginal = almacen.guardarResultado.bind(almacen);
    almacen.guardarResultado = () => { throw new Error('fallo al guardar resultado normalizado'); };
    ahora = new Date('2026-11-22T10:10:00.000Z');

    await assert.rejects(sync.ejecutar(), /fallo al guardar resultado normalizado/);
    assert.equal(almacen.cursorFuente('redmine'), cursorAnterior);
    assert.deepEqual(almacen.ultimosDatosFuente('redmine').datos, snapshotAnterior);

    almacen.guardarResultado = guardarResultadoOriginal;
    ahora = new Date('2026-11-22T10:20:00.000Z');
    await sync.ejecutar();
    assert.equal(almacen.cursorFuente('redmine'), '2026-11-22T10:20:00.000Z');
    assert.equal(almacen.ultimosDatosFuente('redmine').datos.length, 2);
  });

  it('sincroniza GitLab incrementalmente, combina eventos por ID y entrega el snapshot completo al normalizador', async () => {
    let ahora = new Date('2026-11-22T10:00:00.000Z');
    const almacen = new AlmacenMemoria();
    const redmine = new ConectorFalso('redmine', [[issue('INC-2026-031')]]);
    const eventosGitlab = new ConectorFalso('gitlab', [
      [{ id: 'gitlab:17:commit:sha-1:branch:feature/INC-2026-031', tipo: 'commit', rama: 'feature/INC-2026-031', autor: 'puno', fecha: '2026-11-22T09:55:00.000Z' }],
      [
        { id: 'gitlab:17:commit:sha-1:branch:feature/INC-2026-031', tipo: 'commit', rama: 'feature/INC-2026-031', autor: 'puno', fecha: '2026-11-22T09:58:00.000Z', estado: 'success' },
        { id: 'gitlab:17:pipeline:2', tipo: 'pipeline', rama: 'feature/INC-2026-031', autor: null, fecha: '2026-11-22T10:01:00.000Z', estado: 'failed' },
      ],
    ]);
    const sync = new Sincronizacion({ conectores: [redmine, eventosGitlab], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, reloj: () => new Date(ahora) });

    await sync.ejecutar();
    const cursorInicial = almacen.cursorFuente('gitlab');
    ahora = new Date('2026-11-22T10:10:00.000Z');
    await sync.ejecutar();

    assert.equal(eventosGitlab.desdes[0], null);
    assert.equal(eventosGitlab.desdes[1].toISOString(), '2026-11-22T09:55:00.000Z');
    assert.equal(eventosGitlab.desarrolladoresRecibidos, desarrolladores);
    assert.notEqual(almacen.cursorFuente('gitlab'), cursorInicial);
    const snapshot = almacen.ultimosDatosFuente('gitlab').datos;
    assert.equal(snapshot.length, 2);
    assert.equal(snapshot.filter((evento) => evento.id.includes('sha-1')).length, 1);
    assert.equal(almacen.peticiones[0].actividades.length, 2);
    assert.equal(almacen.peticiones[0].actividades.find((actividad) => actividad.tipo === 'commit').fecha, '2026-11-22T09:58:00.000Z');
  });

  it('mantiene el snapshot y cursor de GitLab si falla la lectura y confirma la recuperación posterior', async () => {
    let ahora = new Date('2026-11-22T10:00:00.000Z');
    const almacen = new AlmacenMemoria();
    const redmine = new ConectorFalso('redmine', [[issue('INC-2026-031')]]);
    const gitlab = new ConectorFalso('gitlab', [
      [{ id: 'g:commit:1', tipo: 'commit', rama: 'feature/INC-2026-031', autor: 'puno', fecha: '2026-11-22T09:59:00.000Z' }],
      new Error('fallo en página GitLab'),
      new Error('fallo en página GitLab'),
      new Error('fallo en página GitLab'),
      [{ id: 'g:pipeline:2', tipo: 'pipeline', rama: 'feature/INC-2026-031', autor: null, fecha: '2026-11-22T10:20:00.000Z' }],
    ]);
    const sync = new Sincronizacion({ conectores: [redmine, gitlab], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, reloj: () => new Date(ahora) });
    await sync.ejecutar();
    const cursorAnterior = almacen.cursorFuente('gitlab');
    const snapshotAnterior = almacen.ultimosDatosFuente('gitlab').datos;
    ahora = new Date('2026-11-22T10:10:00.000Z');

    const estadoFallido = await sync.ejecutar();
    assert.equal(estadoFallido.estado, 'parcial');
    assert.equal(almacen.cursorFuente('gitlab'), cursorAnterior);
    assert.deepEqual(almacen.ultimosDatosFuente('gitlab').datos, snapshotAnterior);
    assert.equal(almacen.cursorFuente('redmine'), '2026-11-22T10:10:00.000Z');

    ahora = new Date('2026-11-22T10:20:00.000Z');
    await sync.ejecutar();
    assert.equal(almacen.cursorFuente('gitlab'), '2026-11-22T10:20:00.000Z');
    assert.equal(almacen.ultimosDatosFuente('gitlab').datos.length, 2);
  });

  it('combina deltas Rocket.Chat por rid y _id manteniendo el contrato público', async () => {
    let ahora = new Date('2026-11-22T10:00:00.000Z');
    const almacen = new AlmacenMemoria();
    const identidades = new WeakMap();
    const respuestas = [
      { datos: [{ canal: 'general', texto: 'inicial', fecha: '2026-11-22T09:59:00.000Z' }], meta: [{ rid: 'r1', id: 'm1' }] },
      { datos: [
        { canal: 'general', texto: 'editado', fecha: '2026-11-22T09:59:00.000Z' },
        { canal: 'general', texto: 'nuevo', fecha: '2026-11-22T10:09:00.000Z' },
      ], meta: [{ rid: 'r1', id: 'm1' }, { rid: 'r1', id: 'm2' }] },
    ];
    const ejecucionesPersistidas = [];
    const persistencia = {
      async crearSincronizacion() { return ejecucionesPersistidas.length + 1; },
      async finalizarSincronizacion(resultado) { ejecucionesPersistidas.push(resultado); },
    };
    const rocket = {
      fuente: { nombre: 'rocketchat' },
      desdes: [],
      async leerDatos(desde) {
        this.desdes.push(desde);
        const respuesta = respuestas.shift();
        respuesta.datos.forEach((mensaje, indice) => identidades.set(mensaje, respuesta.meta[indice]));
        return respuesta.datos;
      },
      exportarMetadatos(datos) { return datos.map((mensaje) => identidades.get(mensaje) ?? null); },
      identidadMensaje(mensaje) {
        const identidad = identidades.get(mensaje);
        return identidad ? JSON.stringify([identidad.rid, identidad.id]) : null;
      },
    };
    const sync = new Sincronizacion({ conectores: [rocket], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, reloj: () => new Date(ahora), persistencia });

    await sync.ejecutar();
    ahora = new Date('2026-11-22T10:10:00.000Z');
    await sync.ejecutar();

    assert.equal(rocket.desdes[0], null);
    assert.equal(rocket.desdes[1].toISOString(), '2026-11-22T09:55:00.000Z');
    const snapshot = almacen.ultimosDatosFuente('rocketchat').datos;
    assert.equal(snapshot.length, 2);
    assert.equal(snapshot.find((item) => item.fecha === '2026-11-22T09:59:00.000Z').texto, 'editado');
    assert.deepEqual(Object.keys(snapshot[0]).sort(), ['canal', 'fecha', 'texto']);
    assert.deepEqual(ejecucionesPersistidas[0].snapshots[0].metadatos, [{ rid: 'r1', id: 'm1' }]);
    assert.deepEqual(ejecucionesPersistidas[1].snapshots[0].metadatos, [
      { rid: 'r1', id: 'm1' }, { rid: 'r1', id: 'm2' },
    ]);
  });

  it('si falla la transacción PostgreSQL conserva el resultado, snapshot y cursor anteriores', async () => {
    let ahora = new Date('2026-11-22T10:00:00.000Z');
    const almacen = new AlmacenMemoria();
    let fallaPersistencia = false;
    const persistencia = {
      async crearSincronizacion() { return 41; },
      async finalizarSincronizacion() {
        if (fallaPersistencia) throw new Error('fallo de transacción');
      },
    };
    const redmine = new ConectorFalso('redmine', [
      [issue('INC-2026-031')],
      [{ ...issue('INC-2026-032'), id: 2 }],
    ]);
    const sync = new Sincronizacion({ conectores: [redmine], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, reloj: () => new Date(ahora), persistencia });
    await sync.ejecutar();
    const snapshotAnterior = almacen.ultimosDatosFuente('redmine').datos;
    const cursorAnterior = almacen.cursorFuente('redmine');
    const resultadoAnterior = almacen.peticiones;
    ahora = new Date('2026-11-22T10:10:00.000Z');
    fallaPersistencia = true;

    await assert.rejects(sync.ejecutar(), /fallo de transacción/);

    assert.deepEqual(almacen.ultimosDatosFuente('redmine').datos, snapshotAnterior);
    assert.equal(almacen.cursorFuente('redmine'), cursorAnterior);
    assert.equal(almacen.peticiones, resultadoAnterior);
    assert.equal(sync.enEjecucion, false);
  });

  it('no sobrescribe snapshots persistidos en modo mock y conserva la caché simulada', async () => {
    const almacen = new AlmacenMemoria();
    const snapshotReal = [{ id: 99, subject: 'Snapshot real' }];
    almacen.rehidratarSnapshotFuente('redmine', snapshotReal, '2026-11-22T09:00:00.000Z', '2026-11-22T08:55:00.000Z');
    let snapshotsRecibidos;
    const persistido = { redmine: snapshotReal };
    const persistencia = {
      async crearSincronizacion() { return 52; },
      async finalizarSincronizacion(resultado) {
        snapshotsRecibidos = resultado.snapshots;
        for (const snapshot of resultado.snapshots) persistido[snapshot.nombre] = snapshot.datos;
      },
    };
    const redmine = new ConectorFalso('redmine', [[issue('INC-2026-031')]]);
    const sync = new Sincronizacion({ conectores: [redmine], almacen, desarrolladores, umbral: { maxPeticiones: 0 }, reintentos: 3, esperaReintentoMs: 0, persistencia, modoMocks: true });

    const estado = await sync.ejecutar();

    assert.equal(estado.estado, 'ok');
    assert.deepEqual(snapshotsRecibidos, []);
    assert.equal(persistido.redmine, snapshotReal);
    assert.equal(almacen.ultimosDatosFuente('redmine').datos[0].subject, 'Prueba');
    assert.equal(almacen.cursorFuente('redmine'), null);
  });

  it('rechaza un snapshot Rocket.Chat anterior sin identidad incluso si el delta está vacío', async () => {
    const almacen = new AlmacenMemoria();
    const datosAnteriores = [{ canal: 'general', texto: 'mensaje', fecha: '2026-11-22T09:00:00.000Z' }];
    almacen.rehidratarSnapshotFuente('rocketchat', datosAnteriores, '2026-11-22T09:00:00.000Z', '2026-11-22T09:00:00.000Z');
    const rocket = {
      fuente: { nombre: 'rocketchat' },
      async leerDatos() { return []; },
      exportarMetadatos(datos) { return datos.map(() => null); },
    };
    const sync = crear([rocket], almacen);

    const estado = await sync.ejecutar();

    assert.equal(estado.estado, 'fallida');
    assert.equal(estado.fallos[0].fuente, 'rocketchat');
    assert.deepEqual(almacen.ultimosDatosFuente('rocketchat').datos, datosAnteriores);
    assert.equal(almacen.cursorFuente('rocketchat'), '2026-11-22T09:00:00.000Z');
  });

  it('valida identidades Rocket.Chat también durante una lectura completa', async () => {
    const almacen = new AlmacenMemoria();
    const rocket = {
      fuente: { nombre: 'rocketchat' },
      async leerDatos() { return [{ canal: 'general', texto: 'sin identidad', fecha: '2026-11-22T09:00:00.000Z' }]; },
      exportarMetadatos(datos) { return datos.map(() => null); },
    };
    const estado = await crear([rocket], almacen).ejecutar();

    assert.equal(estado.estado, 'fallida');
    assert.equal(estado.fallos[0].fuente, 'rocketchat');
    assert.equal(almacen.cursorFuente('rocketchat'), null);
    assert.deepEqual(almacen.ultimosDatosFuente('rocketchat'), null);
  });

  it('rechaza snapshot Rocket.Chat previo inválido durante lectura completa y lo conserva', async () => {
    const almacen = new AlmacenMemoria();
    const snapshotAnterior = [{ canal: 'general', texto: 'anterior', fecha: '2026-11-22T09:00:00.000Z' }];
    const delta = [{ canal: 'general', texto: 'nuevo', fecha: '2026-11-22T10:00:00.000Z' }];
    almacen.rehidratarSnapshotFuente('rocketchat', snapshotAnterior, '2026-11-22T09:00:00.000Z', null);
    const rocket = {
      fuente: { nombre: 'rocketchat' },
      async leerDatos() { return delta; },
      exportarMetadatos(mensajes) {
        return mensajes.map((mensaje) => (mensaje === delta[0] ? { rid: 'room-1', id: 'message-2' } : null));
      },
    };

    const estado = await crear([rocket], almacen).ejecutar();

    assert.equal(estado.estado, 'fallida');
    assert.equal(estado.fallos[0].fuente, 'rocketchat');
    assert.match(estado.fallos[0].mensaje, /snapshot anterior/);
    assert.equal(almacen.ultimosDatosFuente('rocketchat').datos, snapshotAnterior);
    assert.equal(almacen.cursorFuente('rocketchat'), null);
  });

  it('confirma PostgreSQL antes de enviar alertas', () => {
    const script = `
      import { Sincronizacion } from './src/sincronizacion/Sincronizacion.js';
      import { AlmacenMemoria } from './src/datos/almacen.js';
      const orden = [];
      globalThis.fetch = async () => { orden.push('alerta'); return { ok: true }; };
      const conector = {
        fuente: { nombre: 'redmine' },
        async leerDatos() { return [{ id: 1, subject: 'Trabajo', tracker: { name: 'Incidente' }, status: { is_closed: false }, assigned_to: { id: 11 }, project: { identifier: 'soporte', name: 'Soporte' }, custom_fields: [{ name: 'Código', value: 'INC-2026-031' }, { name: 'Etapa', value: 'Desarrollo' }] }]; },
      };
      const persistencia = { async crearSincronizacion() { return 1; }, async finalizarSincronizacion() { orden.push('persistencia'); } };
      const almacen = new AlmacenMemoria();
      const sync = new Sincronizacion({ conectores: [conector], almacen, desarrolladores: [{ id: 'd01', nombre: 'Persona Uno', idRedmine: 11 }], umbral: { maxPeticiones: 0 }, persistencia });
      await sync.ejecutar();
      console.log(JSON.stringify({ orden, estado: almacen.estadoSincronizacion.estado, enviada: almacen.alertas[0]?.enviadaRocketChat }));
    `;
    const resultado = ejecutarScriptAislado(script);

    assert.equal(resultado.status, 0, resultado.stderr);
    assert.notEqual(resultado.stdout.trim(), '', JSON.stringify({ stderr: resultado.stderr, error: resultado.error }));
    const salida = JSON.parse(resultado.stdout.trim().split('\n').at(-1));
    assert.deepEqual(salida.orden, ['persistencia', 'alerta']);
    assert.equal(salida.estado, 'ok');
    assert.equal(salida.enviada, true);
  });

  it('no envía alertas si falla la persistencia PostgreSQL', () => {
    const script = `
      import { Sincronizacion } from './src/sincronizacion/Sincronizacion.js';
      import { AlmacenMemoria } from './src/datos/almacen.js';
      const orden = [];
      globalThis.fetch = async () => { orden.push('alerta'); return { ok: true }; };
      const conector = {
        fuente: { nombre: 'redmine' },
        async leerDatos() { return [{ id: 1, subject: 'Trabajo', tracker: { name: 'Incidente' }, status: { is_closed: false }, assigned_to: { id: 11 }, project: { identifier: 'soporte', name: 'Soporte' }, custom_fields: [{ name: 'Código', value: 'INC-2026-031' }, { name: 'Etapa', value: 'Desarrollo' }] }]; },
      };
      const persistencia = { async crearSincronizacion() { return 1; }, async finalizarSincronizacion() { orden.push('persistencia'); throw new Error('fallo SQL'); } };
      const sync = new Sincronizacion({ conectores: [conector], almacen: new AlmacenMemoria(), desarrolladores: [{ id: 'd01', nombre: 'Persona Uno', idRedmine: 11 }], umbral: { maxPeticiones: 0 }, persistencia });
      try { await sync.ejecutar(); } catch {}
      console.log(JSON.stringify({ orden }));
    `;
    const resultado = ejecutarScriptAislado(script);

    assert.equal(resultado.status, 0, resultado.stderr);
    assert.notEqual(resultado.stdout.trim(), '', JSON.stringify({ stderr: resultado.stderr, error: resultado.error }));
    assert.deepEqual(JSON.parse(resultado.stdout.trim().split('\n').at(-1)).orden, ['persistencia']);
  });

  it('un error de envío de alerta no altera el estado confirmado de sincronización', () => {
    const script = `
      import { Sincronizacion } from './src/sincronizacion/Sincronizacion.js';
      import { AlmacenMemoria } from './src/datos/almacen.js';
      globalThis.fetch = async () => { throw new Error('Rocket.Chat no disponible'); };
      const conector = {
        fuente: { nombre: 'redmine' },
        async leerDatos() { return [{ id: 1, subject: 'Trabajo', tracker: { name: 'Incidente' }, status: { is_closed: false }, assigned_to: { id: 11 }, project: { identifier: 'soporte', name: 'Soporte' }, custom_fields: [{ name: 'Código', value: 'INC-2026-031' }, { name: 'Etapa', value: 'Desarrollo' }] }]; },
      };
      const persistencia = { async crearSincronizacion() { return 1; }, async finalizarSincronizacion() {} };
      const almacen = new AlmacenMemoria();
      const estado = await new Sincronizacion({ conectores: [conector], almacen, desarrolladores: [{ id: 'd01', nombre: 'Persona Uno', idRedmine: 11 }], umbral: { maxPeticiones: 0 }, persistencia }).ejecutar();
      console.log(JSON.stringify({ estado: estado.estado, estadoGuardado: almacen.estadoSincronizacion.estado, enviada: almacen.alertas[0]?.enviadaRocketChat }));
    `;
    const resultado = ejecutarScriptAislado(script);

    assert.equal(resultado.status, 0, resultado.stderr);
    assert.notEqual(resultado.stdout.trim(), '', JSON.stringify({ stderr: resultado.stderr, error: resultado.error }));
    const salida = JSON.parse(resultado.stdout.trim().split('\n').at(-1));
    assert.equal(salida.estado, 'ok');
    assert.equal(salida.estadoGuardado, 'ok');
    assert.equal(salida.enviada, false);
  });
});
