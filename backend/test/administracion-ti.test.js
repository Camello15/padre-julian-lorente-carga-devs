import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { crearApp } from '../src/app.js';
import { ServicioSesiones } from '../src/auth/sso-mock.js';
import { crearConectores } from '../src/conectores/index.js';
import { AlmacenMemoria } from '../src/datos/almacen.js';
import { Sincronizacion } from '../src/sincronizacion/Sincronizacion.js';

const desarrolladores = JSON.parse(readFileSync(new URL('../mocks/desarrolladores.json', import.meta.url), 'utf8'));

/** CU-10 Configurar umbral y CU-11 Revisar registros no reconocidos: solo el Administrador TI. */
describe('Administración TI', () => {
  const umbral = { maxPeticiones: 6 };
  let servidor;
  let base;

  const login = async (rol) => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rol }),
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
    const almacen = new AlmacenMemoria();
    await new Sincronizacion({ conectores: crearConectores(), almacen, desarrolladores, umbral, esperaReintentoMs: 0 }).ejecutar();
    servidor = crearApp({ almacen, servicioSesiones: new ServicioSesiones(), umbral, origenFrontend: '*' }).listen(0);
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => servidor.close());

  it('el Administrador TI cambia el umbral y se recalculan las alertas', async () => {
    const token = await login('ADMINISTRADOR_TI');
    const r = await pedir('/api/umbral', token, 'PUT', { maxPeticiones: 20 });
    assert.equal(r.status, 200);
    const datos = await r.json();
    assert.equal(datos.umbral.maxPeticiones, 20);
    assert.equal(datos.alertas.length, 0);

    await pedir('/api/umbral', token, 'PUT', { maxPeticiones: 6 });
  });

  it('rechaza un umbral inválido y conserva el anterior', async () => {
    const r = await pedir('/api/umbral', await login('ADMINISTRADOR_TI'), 'PUT', { maxPeticiones: 0 });
    assert.equal(r.status, 400);
    assert.equal(umbral.maxPeticiones, 6);
  });

  for (const rol of ['ADMINISTRATIVO', 'PMO', 'TECNICO']) {
    it(`el rol ${rol} no puede cambiar el umbral`, async () => {
      const r = await pedir('/api/umbral', await login(rol), 'PUT', { maxPeticiones: 2 });
      assert.equal(r.status, 403);
      assert.equal(umbral.maxPeticiones, 6);
    });

    it(`el rol ${rol} no puede ver ni marcar registros no reconocidos`, async () => {
      const token = await login(rol);
      assert.equal((await pedir('/api/registros-no-reconocidos', token)).status, 403);
      assert.equal((await pedir('/api/registros-no-reconocidos/cualquiera', token, 'PATCH', {})).status, 403);
    });
  }

  it('el Administrador TI marca un registro como revisado', async () => {
    const token = await login('ADMINISTRADOR_TI');
    const { registros } = await (await pedir('/api/registros-no-reconocidos', token)).json();
    assert.ok(registros.length > 0);

    const r = await pedir(`/api/registros-no-reconocidos/${encodeURIComponent(registros[0].id)}`, token, 'PATCH', {});
    assert.equal(r.status, 200);
    assert.equal((await r.json()).registro.revisado, true);

    const pendientes = await (await pedir('/api/registros-no-reconocidos', token)).json();
    assert.equal(pendientes.total, registros.length - 1);
  });

  it('responde 404 si el registro no existe', async () => {
    const r = await pedir('/api/registros-no-reconocidos/no-existe', await login('ADMINISTRADOR_TI'), 'PATCH', {});
    assert.equal(r.status, 404);
  });
});
