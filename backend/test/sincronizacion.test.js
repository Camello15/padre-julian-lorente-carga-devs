import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Conector } from '../src/conectores/Conector.js';
import { crearConectores } from '../src/conectores/index.js';
import { AlmacenMemoria } from '../src/datos/almacen.js';
import { extraerCodigo, unificar } from '../src/sincronizacion/normalizador.js';
import { Sincronizacion } from '../src/sincronizacion/Sincronizacion.js';

const desarrolladores = [{ id: 'd01', nombre: 'Persona Uno', idRedmine: 11, usuarioGitlab: 'puno', usuarioGlpi: 'puno' }];
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

    ahora = new Date('2026-11-22T10:20:00.000Z');
    await sync.ejecutar();
    assert.equal(almacen.cursorFuente('gitlab'), '2026-11-22T10:20:00.000Z');
    assert.equal(almacen.ultimosDatosFuente('gitlab').datos.length, 2);
  });
});
