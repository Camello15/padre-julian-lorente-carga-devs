import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { after, describe, it } from 'node:test';

const variablesOriginales = new Map(
  ['USAR_MOCKS', 'ROCKETCHAT_URL', 'ROCKETCHAT_USER_ID', 'ROCKETCHAT_TOKEN', 'ROCKETCHAT_CANALES_LECTURA']
    .map((nombre) => [nombre, process.env[nombre]]),
);
process.env.USAR_MOCKS = 'false';
process.env.ROCKETCHAT_URL = 'https://rocket.example.test';
process.env.ROCKETCHAT_USER_ID = 'user-id-secret';
process.env.ROCKETCHAT_TOKEN = 'auth-token-secret';
process.env.ROCKETCHAT_CANALES_LECTURA = ' canal-publico, grupo-privado, canal-publico, , grupo-privado ';

const { ConectorRocketChat } = await import('../src/conectores/ConectorRocketChat.js');
const { config } = await import('../src/config.js');
const conector = () => new ConectorRocketChat({ nombre: 'rocketchat', urlApi: config.fuentes.rocketchat.url });

const respuesta = (cuerpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (cuerpo instanceof Error) throw cuerpo;
    return cuerpo;
  },
});

const sala = (id, name, t) => ({ success: true, room: { _id: id, name, t } });
const mensaje = (rid, id, msg = `texto ${id}`) => ({ rid, _id: id, msg, ts: '2026-11-22T10:00:00.000Z' });
const pagina = (messages, offset, total) => ({
  success: true,
  messages,
  offset,
  ...(total === undefined ? {} : { total }),
});

after(() => {
  for (const [nombre, valor] of variablesOriginales) {
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
  }
});

describe('ConectorRocketChat API', () => {
  it('limpia nombres de canales vacíos y repetidos en la configuración', () => {
    assert.deepEqual(config.fuentes.rocketchat.canalesLectura, ['canal-publico', 'grupo-privado']);
    assert.equal(config.fuentes.rocketchat.canalAlertas, '#ti-alertas');
  });

  it('resuelve una sala pública, consulta channels.history y adapta al contrato sin campos extra', async (t) => {
    const llamadas = [];
    t.mock.method(globalThis, 'fetch', async (url, opciones) => {
      const parsed = new URL(url);
      llamadas.push({ parsed, opciones });
      if (parsed.pathname.endsWith('/rooms.info')) return respuesta(sala('room-c-1', 'canal-publico', 'c'));
      if (parsed.pathname.endsWith('/channels.history')) {
        return respuesta(pagina([mensaje('room-c-1', 'msg-1', 'INC-2026-031 actualizado')], 0, 1));
      }
      throw new Error(`Ruta inesperada: ${parsed.pathname}`);
    });

    const mensajes = await conector().leerDatos();

    assert.deepEqual(mensajes, [{ canal: 'canal-publico', texto: 'INC-2026-031 actualizado', fecha: '2026-11-22T10:00:00.000Z' }]);
    assert.deepEqual(Object.keys(mensajes[0]).sort(), ['canal', 'fecha', 'texto']);
    assert.equal(llamadas[0].parsed.pathname, '/api/v1/rooms.info');
    assert.equal(llamadas[0].parsed.searchParams.get('roomName'), 'canal-publico');
    assert.equal(llamadas[1].parsed.pathname, '/api/v1/channels.history');
    assert.equal(llamadas[1].parsed.searchParams.get('roomId'), 'room-c-1');
    assert.equal(llamadas[1].parsed.searchParams.get('count'), '50');
    assert.equal(llamadas[1].parsed.searchParams.get('offset'), '0');
    assert.ok(llamadas.every(({ opciones }) => opciones.headers['X-Auth-Token'] === 'auth-token-secret'));
    assert.ok(llamadas.every(({ opciones }) => opciones.headers['X-User-Id'] === 'user-id-secret'));
    assert.ok(llamadas.every(({ parsed }) => !parsed.href.includes('secret')));
  });

  it('aplica oldest y exporta y rehidrata IDs como metadatos internos', async (t) => {
    const llamadas = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      llamadas.push(parsed);
      if (parsed.pathname.endsWith('/rooms.info')) return respuesta(sala('room-c-1', 'canal-publico', 'c'));
      if (parsed.pathname.endsWith('/channels.history')) {
        return respuesta(pagina([mensaje('room-c-1', 'msg-1')], 0, 1));
      }
      throw new Error(`Ruta inesperada: ${parsed.pathname}`);
    });

    const instancia = conector();
    const desde = new Date('2026-11-22T09:55:00.000Z');
    const mensajes = await instancia.leerDatos(desde);
    const metadatos = instancia.exportarMetadatos(mensajes);
    const historial = llamadas.find((url) => url.pathname.endsWith('/channels.history'));

    assert.equal(historial.searchParams.get('oldest'), desde.toISOString());
    assert.equal(historial.searchParams.get('inclusive'), 'true');
    assert.deepEqual(mensajes, [{ canal: 'canal-publico', texto: 'texto msg-1', fecha: '2026-11-22T10:00:00.000Z' }]);
    assert.deepEqual(Object.keys(mensajes[0]).sort(), ['canal', 'fecha', 'texto']);
    assert.deepEqual(metadatos, [{ rid: 'room-c-1', id: 'msg-1' }]);

    const recargados = mensajes.map((item) => ({ ...item }));
    const instanciaRehidratada = conector();
    instanciaRehidratada.rehidratarMetadatos(recargados, metadatos);
    assert.equal(instanciaRehidratada.identidadMensaje(recargados[0]), JSON.stringify(['room-c-1', 'msg-1']));
  });

  it('rechaza exportar mensajes que no tienen una identidad interna asociada', () => {
    const instancia = conector();
    assert.throws(
      () => instancia.exportarMetadatos([{ canal: 'canal-publico', texto: 'texto', fecha: '2026-11-22T10:00:00.000Z' }]),
      /sin identidad interna válida/,
    );
  });

  it('rehidrata solo metadatos completos, válidos y alineados con los mensajes', () => {
    const instancia = conector();
    const mensajes = [{ canal: 'canal-publico', texto: 'texto', fecha: '2026-11-22T10:00:00.000Z' }];

    assert.throws(() => instancia.rehidratarMetadatos(mensajes, [null]), /Identidad.*inválida/);
    assert.throws(() => instancia.rehidratarMetadatos(mensajes, [{ rid: 'room-1' }]), /Identidad.*inválida/);
    assert.throws(() => instancia.rehidratarMetadatos(mensajes, [{ rid: ' ', id: 'msg-1' }]), /Identidad.*inválida/);
    assert.throws(() => instancia.rehidratarMetadatos(mensajes, []), /Metadatos.*inválidos/);
  });

  it('rechaza un mensaje de API sin rid o _id', async (t) => {
    for (const parcial of [
      { _id: 'msg-1', msg: 'texto', ts: '2026-11-22T10:00:00.000Z' },
      { rid: 'room-c-1', msg: 'texto', ts: '2026-11-22T10:00:00.000Z' },
    ]) {
      t.mock.restoreAll();
      t.mock.method(globalThis, 'fetch', async (url) => {
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('/rooms.info')) return respuesta(sala('room-c-1', 'canal-publico', 'c'));
        if (parsed.pathname.endsWith('/channels.history')) return respuesta(pagina([parcial], 0, 1));
        throw new Error(`Ruta inesperada: ${parsed.pathname}`);
      });

      await assert.rejects(conector().leerDatos(), /mensaje incompleto/);
    }
  });

  it('resuelve grupos privados y usa groups.history', async (t) => {
    const endpoints = [];
    const canalesOriginales = config.fuentes.rocketchat.canalesLectura;
    config.fuentes.rocketchat.canalesLectura = ['grupo-privado'];
    t.after(() => { config.fuentes.rocketchat.canalesLectura = canalesOriginales; });
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      endpoints.push(parsed.pathname);
      if (parsed.pathname.endsWith('/rooms.info')) {
        const name = parsed.searchParams.get('roomName');
        return respuesta(sala('room-p-1', name, 'p'));
      }
      if (parsed.pathname.endsWith('/groups.history')) {
        return respuesta(pagina([mensaje('room-p-1', 'msg-p')], 0, 1));
      }
      throw new Error(`Ruta inesperada: ${parsed.pathname}`);
    });

    const mensajes = await conector().leerDatos();

    assert.ok(endpoints.includes('/api/v1/groups.history'));
    assert.equal(endpoints.includes('/api/v1/channels.history'), false);
    assert.ok(mensajes.some((item) => item.canal === 'grupo-privado'));
  });

  it('usa total para paginar completamente cuando es múltiplo exacto de count y deduplica mensajes', async (t) => {
    const offsets = [];
    const limitesSuperiores = [];
    const primera = Array.from({ length: 50 }, (_, i) => mensaje('room-c-1', `m-${i}`));
    const segunda = [mensaje('room-c-1', 'm-0'), ...Array.from({ length: 49 }, (_, i) => mensaje('room-c-1', `m-${i + 50}`))];
    let historial = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/rooms.info')) {
        return respuesta(sala('room-c-1', parsed.searchParams.get('roomName'), 'c'));
      }
      if (parsed.pathname.endsWith('/channels.history')) {
        historial += 1;
        offsets.push(parsed.searchParams.get('offset'));
        limitesSuperiores.push(parsed.searchParams.get('latest'));
        return historial === 1 ? respuesta(pagina(primera, 0, 100)) : respuesta(pagina(segunda, 50, 100));
      }
      throw new Error(`Ruta inesperada: ${parsed.pathname}`);
    });

    const mensajes = await conector().leerDatos();

    assert.deepEqual(offsets, ['0', '50']);
    assert.equal(limitesSuperiores[0], limitesSuperiores[1]);
    assert.equal(mensajes.length, 99);
    assert.equal(mensajes.filter((item) => item.texto === 'texto m-0').length, 1);
  });

  it('pagina sin total hasta una página incompleta o vacía', async (t) => {
    const offsets = [];
    let historial = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/rooms.info')) {
        return respuesta(sala('room-c-1', parsed.searchParams.get('roomName'), 'c'));
      }
      if (parsed.pathname.endsWith('/channels.history')) {
        historial += 1;
        offsets.push(parsed.searchParams.get('offset'));
        if (historial === 1) return respuesta(pagina(Array.from({ length: 50 }, (_, i) => mensaje('room-c-1', `m-${i}`)), 0));
        if (historial === 2) return respuesta(pagina(Array.from({ length: 50 }, (_, i) => mensaje('room-c-1', `m-${i + 50}`)), 50));
        return respuesta(pagina([], 100));
      }
      throw new Error(`Ruta inesperada: ${parsed.pathname}`);
    });

    const mensajes = await conector().leerDatos();

    assert.deepEqual(offsets, ['0', '50', '100']);
    assert.equal(mensajes.length, 100);
  });

  it('no repite la lectura si dos nombres resuelven al mismo roomId y deduplica mensajes por rid + _id', async (t) => {
    const cuentas = { resolve: 0, history: 0 };
    const canalesOriginales = config.fuentes.rocketchat.canalesLectura;
    config.fuentes.rocketchat.canalesLectura = ['nombre-uno', 'nombre-dos'];
    t.after(() => { config.fuentes.rocketchat.canalesLectura = canalesOriginales; });
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/rooms.info')) {
        cuentas.resolve += 1;
        return respuesta(sala('room-repetido', parsed.searchParams.get('roomName'), 'c'));
      }
      if (parsed.pathname.endsWith('/channels.history')) {
        cuentas.history += 1;
        return respuesta(pagina([
          mensaje('room-repetido', 'mismo-id'),
          mensaje('room-repetido', 'mismo-id'),
        ], 0, 2));
      }
      throw new Error(`Ruta inesperada: ${parsed.pathname}`);
    });

    const mensajes = await conector().leerDatos();

    assert.deepEqual(cuentas, { resolve: 2, history: 1 });
    assert.equal(mensajes.length, 1);
  });

  it('distingue autenticación, permisos y sala inexistente con errores seguros', async (t) => {
    let estado = 401;
    let cuerpo = { success: false, error: 'detalle con auth-token-secret', errorType: 'error-not-logged' };
    t.mock.method(globalThis, 'fetch', async () => respuesta(cuerpo, estado));

    await assert.rejects(conector().leerDatos(), (error) => {
      assert.match(error.message, /Autenticación.*inválida/);
      assert.doesNotMatch(error.message, /auth-token-secret|user-id-secret|detalle/);
      return true;
    });

    estado = 403;
    cuerpo = { success: false, error: 'secreto', errorType: 'error-forbidden' };
    await assert.rejects(conector().leerDatos(), (error) => {
      assert.match(error.message, /Permisos insuficientes/);
      assert.doesNotMatch(error.message, /secreto|auth-token-secret/);
      return true;
    });

    estado = 400;
    cuerpo = { success: false, error: 'detalle privado', errorType: 'error-room-not-found' };
    await assert.rejects(conector().leerDatos(), (error) => {
      assert.match(error.message, /no existe/);
      assert.doesNotMatch(error.message, /detalle privado|auth-token-secret/);
      return true;
    });

    cuerpo = { success: false, error: 'texto no clasificable' };
    await assert.rejects(conector().leerDatos(), (error) => {
      assert.match(error.message, /No se pudo resolver la sala/);
      assert.doesNotMatch(error.message, /no clasificable|auth-token-secret/);
      return true;
    });
  });

  it('propaga errores HTTP, red y JSON inválido sin filtrar credenciales', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => respuesta({ error: 'backend secreto' }, 500));
    await assert.rejects(conector().leerDatos(), (error) => {
      assert.match(error.message, /HTTP 500/);
      assert.doesNotMatch(error.message, /backend secreto|auth-token-secret|user-id-secret/);
      return true;
    });

    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('fallo con auth-token-secret'); });
    await assert.rejects(conector().leerDatos(), (error) => {
      assert.equal(error.message, 'No se pudo conectar con Rocket.Chat');
      assert.doesNotMatch(error.message, /auth-token-secret|user-id-secret/);
      return true;
    });

    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => respuesta(new SyntaxError('JSON con auth-token-secret')));
    await assert.rejects(conector().leerDatos(), (error) => {
      assert.equal(error.message, 'Rocket.Chat devolvió JSON inválido');
      assert.doesNotMatch(error.message, /auth-token-secret|user-id-secret/);
      return true;
    });
  });

  it('rechaza estructura de sala e historial incompleta', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => respuesta({ success: true, room: { _id: 'room', name: 'canal', t: 'd' } }));
    await assert.rejects(conector().leerDatos(), /Respuesta de Rocket.Chat inválida al resolver la sala/);

    t.mock.restoreAll();
    let llamada = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
      llamada += 1;
      return llamada === 1
        ? respuesta(sala('room-c', new URL(url).searchParams.get('roomName'), 'c'))
        : respuesta(pagina([{ rid: 'room-c', _id: 'msg' }], 0, 1));
    });
    await assert.rejects(conector().leerDatos(), /mensaje incompleto/);
  });

  it('mantiene el modo mock actual', () => {
    const script = `
      import { ConectorRocketChat } from ${JSON.stringify(new URL('../src/conectores/ConectorRocketChat.js', import.meta.url).href)};
      const mensajes = await new ConectorRocketChat({ nombre: 'rocketchat', urlApi: '' }).leerDatos();
      if (!Array.isArray(mensajes) || mensajes.length !== 4 || !('canal' in mensajes[0]) || !('texto' in mensajes[0]) || !('fecha' in mensajes[0])) process.exit(1);
    `;
    const resultado = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '', USAR_MOCKS: 'true', MOCK_FALLA_FUENTE: '' },
    });
    assert.equal(resultado.status, 0, resultado.stderr);
  });
});
