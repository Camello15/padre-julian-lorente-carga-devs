import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Conector } from '../src/conectores/Conector.js';
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
  constructor(nombre, respuestas) { super({ nombre, urlApi: '', activa: true }); this.respuestas = respuestas; this.llamadas = 0; }
  async leerDatos() {
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
});
