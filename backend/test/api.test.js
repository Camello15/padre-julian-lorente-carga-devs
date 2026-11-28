import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { crearApp } from '../src/app.js';
import { ServicioSesiones } from '../src/auth/sso-mock.js';
import { crearConectores } from '../src/conectores/index.js';
import { AlmacenMemoria } from '../src/datos/almacen.js';
import { Sincronizacion } from '../src/sincronizacion/Sincronizacion.js';

const desarrolladores = JSON.parse(readFileSync(new URL('../mocks/desarrolladores.json', import.meta.url), 'utf8'));
const umbral = { maxPeticiones: 6 };
let servidor;
let base;

const login = async (rol) => {
  const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rol }) });
  return (await r.json()).token;
};
const get = (ruta, token) => fetch(`${base}${ruta}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

describe('API con datos de prueba', () => {
  before(async () => {
    const almacen = new AlmacenMemoria();
    await new Sincronizacion({ conectores: crearConectores(), almacen, desarrolladores, umbral, esperaReintentoMs: 0 }).ejecutar();
    servidor = crearApp({ almacen, servicioSesiones: new ServicioSesiones(), umbral, origenFrontend: '*' }).listen(0);
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => servidor.close());

  it('rechaza peticiones sin sesión', async () => {
    assert.equal((await get('/api/carga')).status, 401);
  });

  it('rechaza un rol inexistente', async () => {
    const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"rol":"ADMIN"}' });
    assert.equal(r.status, 400);
  });

  it('la PMO ve la carga de los 7 desarrolladores', async () => {
    const carga = await (await get('/api/carga', await login('PMO'))).json();
    assert.equal(carga.indicadores.length, 7);
    assert.ok(carga.resumen.desarrolladoresSobreUmbral >= 1);
  });

  it('el Técnico no puede ver peticiones de otro desarrollador', async () => {
    const datos = await (await get('/api/peticiones?desarrollador=d02', await login('TECNICO'))).json();
    assert.ok(datos.total > 0);
    assert.ok(datos.peticiones.every((p) => p.desarrolladorId === 'd01'));
  });

  it('responde 400 ante un filtro inválido', async () => {
    assert.equal((await get('/api/peticiones?tipo=TAREA', await login('PMO'))).status, 400);
  });

  it('expone el estado de la sincronización', async () => {
    const estado = await (await get('/api/sincronizacion/estado', await login('ADMINISTRATIVO'))).json();
    assert.equal(estado.estado, 'ok');
    assert.equal(estado.fuentes.length, 4);
  });
});
