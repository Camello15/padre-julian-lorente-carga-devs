import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { crearApp } from '../src/app.js';
import { ServicioSesiones } from '../src/auth/sso-mock.js';
import { Conector } from '../src/conectores/Conector.js';
import { crearConectores } from '../src/conectores/index.js';
import { AlmacenPostgres } from '../src/datos/almacen-postgres.js';
import { Sincronizacion } from '../src/sincronizacion/Sincronizacion.js';
import { crearBaseTemporal, urlPruebas } from './apoyo/postgres.js';

const leerMock = (archivo) => JSON.parse(readFileSync(new URL(`../mocks/${archivo}`, import.meta.url), 'utf8'));
const desarrolladores = leerMock('desarrolladores.json');
const usuarios = leerMock('usuarios-sso.json');

class ConectorCaido extends Conector {
  constructor(nombre) { super({ nombre, urlApi: '', activa: true }); }
  async leerDatos() { throw new Error(`${this.fuente.nombre} no responde`); }
}

const sincronizar = (almacen, umbral, conectores = crearConectores()) =>
  new Sincronizacion({ conectores, almacen, desarrolladores, umbral, esperaReintentoMs: 0 }).ejecutar();

/** Simula un reinicio del backend: almacén nuevo sobre la misma base. */
async function arrancar(bd, umbral = { maxPeticiones: 6 }) {
  const almacen = new AlmacenPostgres({ pool: bd.crearPool() });
  await almacen.inicializar({ desarrolladores, usuarios, umbral });
  return almacen;
}

const contar = async (bd, tabla) => Number((await bd.consultar(`SELECT count(*) FROM ${tabla}`)).rows[0].count);

describe('AlmacenPostgres (integración)', { skip: !urlPruebas && 'Define TEST_DATABASE_URL para correr estas pruebas' }, () => {
  let bd;
  before(async () => { bd = await crearBaseTemporal(); });
  after(async () => { await bd?.borrar(); });

  it('copia Desarrolladores y Usuarios de prueba a la base', async () => {
    await arrancar(bd);
    assert.equal(await contar(bd, 'desarrollador'), desarrolladores.length);
    const { rows } = await bd.consultar("SELECT r.clave FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = 'u-ati'");
    assert.equal(rows[0].clave, 'ADMINISTRADOR_TI');
  });

  it('guarda una Sincronización completa (CU-05 a CU-09)', async () => {
    const umbral = { maxPeticiones: 6 };
    const almacen = await arrancar(bd, umbral);
    const estado = await sincronizar(almacen, umbral);

    assert.equal(await contar(bd, 'peticion'), almacen.peticiones.length);
    assert.equal(await contar(bd, 'lectura_fuente'), 4);
    assert.equal(await contar(bd, 'indicador_carga'), desarrolladores.length);
    assert.equal(await contar(bd, 'alerta'), almacen.alertas.length);
    assert.ok(almacen.alertas.length > 0, 'los mocks deben generar al menos una alerta');
    assert.equal(await contar(bd, 'registro_no_reconocido'), almacen.registrosNoReconocidos.length);
    assert.ok((await contar(bd, 'actividad_codigo')) > 0);
    assert.ok((await contar(bd, 'peticion_modulo')) > 0);

    const { rows } = await bd.consultar('SELECT estado FROM sincronizacion ORDER BY id DESC LIMIT 1');
    assert.equal(rows[0].estado, estado.estado);
  });

  it('no duplica Peticiones, Actividades ni registros al volver a sincronizar', async () => {
    const umbral = { maxPeticiones: 6 };
    const almacen = await arrancar(bd, umbral);
    const antes = await Promise.all(['peticion', 'actividad_codigo', 'registro_no_reconocido', 'peticion_modulo'].map((t) => contar(bd, t)));
    await sincronizar(almacen, umbral);
    const despues = await Promise.all(['peticion', 'actividad_codigo', 'registro_no_reconocido', 'peticion_modulo'].map((t) => contar(bd, t)));
    assert.deepEqual(despues, antes);
  });

  it('la revisión de un registro no reconocido sobrevive a un reinicio (CU-11)', async () => {
    const umbral = { maxPeticiones: 6 };
    const almacen = await arrancar(bd, umbral);
    await sincronizar(almacen, umbral);
    const [registro] = almacen.listarRegistrosNoReconocidos();
    const peticion = almacen.peticiones[0].codigo;
    await almacen.marcarRegistroNoReconocido(registro.id, peticion);

    const reiniciado = await arrancar(bd, umbral);
    await sincronizar(reiniciado, umbral);
    const recuperado = reiniciado.listarRegistrosNoReconocidos({ incluirRevisados: true }).find((r) => r.id === registro.id);
    assert.equal(recuperado.revisado, true);
    assert.equal(recuperado.peticionAsignada, peticion);
    assert.ok(reiniciado.listarRegistrosNoReconocidos().every((r) => r.id !== registro.id));
  });

  it('si una Fuente falla tras reiniciar, usa sus últimos datos guardados (RNF-01, CU-06)', async () => {
    const umbral = { maxPeticiones: 6 };
    const referencia = await arrancar(bd, umbral);
    await sincronizar(referencia, umbral);
    const total = referencia.peticiones.length;

    const reiniciado = await arrancar(bd, umbral);
    const conectores = crearConectores().map((c) => (c.fuente.nombre === 'redmine' ? new ConectorCaido('redmine') : c));
    const estado = await sincronizar(reiniciado, umbral, conectores);

    assert.equal(estado.estado, 'parcial');
    assert.equal(estado.fuentes.find((f) => f.nombre === 'redmine').estado, 'con-datos-anteriores');
    assert.equal(reiniciado.peticiones.length, total);
    const { rows } = await bd.consultar(
      "SELECT r.intentos FROM registro_fallo r JOIN fuente f ON f.id = r.fuente_id WHERE f.nombre = 'redmine'",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].intentos, 3);
  });

  describe('API con PostgreSQL', () => {
    const umbral = { maxPeticiones: 6 };
    let servidor;
    let base;
    const login = async (rol) => {
      const r = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rol }),
      });
      return (await r.json()).token;
    };
    const pedir = (ruta, token, metodo = 'GET', cuerpo) =>
      fetch(`${base}${ruta}`, {
        method: metodo,
        headers: { authorization: `Bearer ${token}`, ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });

    before(async () => {
      const almacen = await arrancar(bd, umbral);
      await sincronizar(almacen, umbral);
      servidor = crearApp({ almacen, servicioSesiones: new ServicioSesiones(), umbral, origenFrontend: '*' }).listen(0);
      base = `http://127.0.0.1:${servidor.address().port}`;
    });
    after(() => servidor?.close());

    it('el Umbral configurado por el Administrador TI se guarda y se recupera al reiniciar (CU-10)', async () => {
      const r = await pedir('/api/umbral', await login('ADMINISTRADOR_TI'), 'PUT', { maxPeticiones: 9 });
      assert.equal(r.status, 200);

      const { rows } = await bd.consultar('SELECT max_peticiones, configurado_por FROM umbral ORDER BY id DESC LIMIT 1');
      assert.deepEqual(rows[0], { max_peticiones: 9, configurado_por: 'u-ati' });

      const umbralNuevo = { maxPeticiones: 6 }; // Valor de UMBRAL_MAX_PETICIONES.
      await arrancar(bd, umbralNuevo);
      assert.equal(umbralNuevo.maxPeticiones, 9);
      assert.equal(umbralNuevo.configuradoPor, 'u-ati');
    });

    it('rechaza vincular un registro a una Petición que no existe (CU-11)', async () => {
      const token = await login('ADMINISTRADOR_TI');
      const { registros } = await (await pedir('/api/registros-no-reconocidos', token)).json();
      const r = await pedir(`/api/registros-no-reconocidos/${encodeURIComponent(registros[0].id)}`, token, 'PATCH', { peticionCodigo: 'POA-1999-999' });
      assert.equal(r.status, 400);
    });
  });
});
