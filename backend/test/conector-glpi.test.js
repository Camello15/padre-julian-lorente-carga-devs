import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { after, describe, it } from 'node:test';

const variablesOriginales = new Map(
  ['USAR_MOCKS', 'GLPI_URL', 'GLPI_APP_TOKEN', 'GLPI_USER_TOKEN'].map((nombre) => [nombre, process.env[nombre]]),
);
process.env.USAR_MOCKS = 'false';
process.env.GLPI_URL = 'https://glpi.example.test';
process.env.GLPI_APP_TOKEN = 'app-secret-test';
process.env.GLPI_USER_TOKEN = 'user-secret-test';

const { ConectorGlpi } = await import('../src/conectores/ConectorGlpi.js');
const { config } = await import('../src/config.js');
const conector = () => new ConectorGlpi({ nombre: 'glpi', urlApi: config.fuentes.glpi.url });
const sesion = 'session-secret-test';

const respuesta = (cuerpo, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(headers),
  json: async () => {
    if (cuerpo instanceof Error) throw cuerpo;
    return cuerpo;
  },
});

const respuestaSesion = () => respuesta({ session_token: sesion });
const respuestaCierre = (status = 200) => respuesta({ message: 'session closed' }, status);

after(() => {
  for (const [nombre, valor] of variablesOriginales) {
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
  }
});

describe('ConectorGlpi API', () => {
  it('inicia sesión con user token y app token en encabezados, nunca en la URL', async (t) => {
    const llamadas = [];
    t.mock.method(globalThis, 'fetch', async (url, opciones) => {
      llamadas.push({ url: new URL(url), opciones });
      if (llamadas.length === 1) return respuestaSesion();
      if (llamadas.length === 2) return respuesta([], 200, { 'Content-Range': '0-0/0', 'Accept-Range': 'Ticket 50' });
      return respuestaCierre();
    });

    await conector().leerDatos();

    assert.equal(llamadas[0].url.pathname, '/apirest.php/initSession');
    assert.equal(llamadas[0].opciones.headers.Authorization, 'user_token user-secret-test');
    assert.equal(llamadas[0].opciones.headers['App-Token'], 'app-secret-test');
    assert.equal(llamadas[0].url.search, '');
    assert.ok(llamadas.every(({ url }) => !url.href.includes('secret')));
    assert.equal(llamadas.at(-1).url.pathname, '/apirest.php/killSession');
    assert.equal(llamadas.at(-1).opciones.headers['Session-Token'], sesion);
  });

  it('lee tickets y adapta id, name y tecnico_asignado al contrato del normalizador', async (t) => {
    const rutas = [];
    t.mock.method(globalThis, 'fetch', async (url, opciones) => {
      const parsed = new URL(url);
      rutas.push({ parsed, opciones });
      if (parsed.pathname.endsWith('/initSession')) return respuestaSesion();
      if (parsed.pathname.endsWith('/Ticket/')) {
        assert.equal(opciones.headers['Session-Token'], sesion);
        assert.equal(opciones.headers['App-Token'], 'app-secret-test');
        return respuesta([{ id: 23, name: '[INC-2026-031] Falla de prueba' }], 200, {
          'Content-Range': '0-0/1',
          'Accept-Range': 'Ticket 50',
        });
      }
      return respuestaCierre();
    });

    const tickets = await conector().leerDatos();

    assert.deepEqual(tickets, [{ id: 23, name: '[INC-2026-031] Falla de prueba', tecnico_asignado: null }]);
    assert.equal(rutas[1].parsed.searchParams.get('range'), '0-0');
  });

  it('lee incrementalmente por date_mod conservando el contrato GLPI', async (t) => {
    const llamadas = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      llamadas.push(parsed);
      if (parsed.pathname.endsWith('/initSession')) return respuestaSesion();
      if (parsed.pathname.endsWith('/listSearchOptions/Ticket')) {
        return respuesta({ common: 'Características', '17': { field: 'date_mod', name: 'Última actualización' } });
      }
      if (parsed.pathname.endsWith('/search/Ticket')) {
        return respuesta({ totalcount: 1, count: 1, data: { '23': { '1': 23, '2': '[INC-2026-031] Actualizada' } } }, 200, {
          'Content-Range': '0-0/1', 'Accept-Range': 'Ticket 50',
        });
      }
      return respuestaCierre();
    });

    const tickets = await conector().leerDatos(new Date('2026-11-22T10:00:00.000Z'));

    assert.deepEqual(tickets, [{ id: 23, name: '[INC-2026-031] Actualizada', tecnico_asignado: null }]);
    const busqueda = llamadas.find((url) => url.pathname.endsWith('/search/Ticket'));
    assert.equal(busqueda.searchParams.get('criteria[0][field]'), '17');
    assert.equal(busqueda.searchParams.get('criteria[0][searchtype]'), 'morethan');
    assert.equal(busqueda.searchParams.get('criteria[0][value]'), '2026-11-22 10:00:00.000');
    assert.equal(busqueda.searchParams.get('forcedisplay[0]'), '1');
    assert.equal(busqueda.searchParams.get('forcedisplay[1]'), '2');
    assert.equal(llamadas.at(-1).pathname, '/apirest.php/killSession');
  });

  it('pagina usando los rangos y el límite indicados por los encabezados GLPI', async (t) => {
    const rangos = [];
    let ticketPage = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/initSession')) return respuestaSesion();
      if (parsed.pathname.endsWith('/Ticket/')) {
        rangos.push(parsed.searchParams.get('range'));
        ticketPage += 1;
        if (ticketPage === 1) return respuesta([{ id: 1, name: 'Ticket uno' }], 206, {
          'Content-Range': '0-0/3', 'Accept-Range': 'Ticket 2',
        });
        return respuesta([{ id: 2, name: 'Ticket dos' }, { id: 3, name: 'Ticket tres' }], 200, {
          'Content-Range': '1-2/3', 'Accept-Range': 'Ticket 2',
        });
      }
      return respuestaCierre();
    });

    const tickets = await conector().leerDatos();

    assert.deepEqual(rangos, ['0-0', '1-2']);
    assert.deepEqual(tickets.map(({ id }) => id), [1, 2, 3]);
  });

  it('cierra la sesión tras una lectura correcta', async (t) => {
    const rutas = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      rutas.push(parsed.pathname);
      if (parsed.pathname.endsWith('/initSession')) return respuestaSesion();
      if (parsed.pathname.endsWith('/Ticket/')) return respuesta([], 200, {
        'Content-Range': '0-0/0', 'Accept-Range': 'Ticket 50',
      });
      return respuestaCierre();
    });

    await conector().leerDatos();

    assert.deepEqual(rutas, ['/apirest.php/initSession', '/apirest.php/Ticket/', '/apirest.php/killSession']);
  });

  it('cierra la sesión tras fallo de lectura y conserva el error original si también falla el cierre', async (t) => {
    const rutas = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      const ruta = new URL(url).pathname;
      rutas.push(ruta);
      if (ruta.endsWith('/initSession')) return respuestaSesion();
      if (ruta.endsWith('/Ticket/')) return respuesta({ error: 'detalle privado' }, 503);
      return respuesta({ error: 'cierre fallido' }, 500);
    });

    await assert.rejects(conector().leerDatos(), (error) => {
      assert.equal(error.message, 'GLPI respondió HTTP 503');
      assert.doesNotMatch(error.message, /detalle privado|cierre fallido|secret-test/);
      return true;
    });
    assert.deepEqual(rutas, ['/apirest.php/initSession', '/apirest.php/Ticket/', '/apirest.php/killSession']);
  });

  it('propaga un fallo de cierre cuando la lectura terminó correctamente sin incluir secretos', async (t) => {
    let llamada = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      llamada += 1;
      if (llamada === 1) return respuestaSesion();
      if (llamada === 2) return respuesta([], 200, { 'Content-Range': '0-0/0', 'Accept-Range': 'Ticket 50' });
      return respuesta({ error: 'privado' }, 500);
    });

    await assert.rejects(conector().leerDatos(), (error) => {
      assert.equal(error.message, 'No se pudo cerrar la sesión de GLPI');
      assert.doesNotMatch(error.message, /privado|secret-test/);
      return true;
    });
  });

  it('propaga errores HTTP, de red y JSON sin devolver listas vacías ni filtrar tokens', async (t) => {
    let llamada = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      llamada += 1;
      if (llamada === 1) return respuestaSesion();
      if (llamada === 2) return respuesta({ error: 'cuerpo privado' }, 401);
      return respuestaCierre();
    });
    await assert.rejects(conector().leerDatos(), (error) => {
      assert.equal(error.message, 'GLPI respondió HTTP 401');
      assert.doesNotMatch(error.message, /privado|secret-test/);
      return true;
    });

    t.mock.restoreAll();
    llamada = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      llamada += 1;
      if (llamada === 1) return respuestaSesion();
      if (llamada === 2) throw new Error('red privada con token');
      return respuestaCierre();
    });
    await assert.rejects(conector().leerDatos(), (error) => {
      assert.equal(error.message, 'No se pudo conectar con GLPI');
      assert.doesNotMatch(error.message, /privado|secret-test/);
      return true;
    });

    t.mock.restoreAll();
    llamada = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      llamada += 1;
      if (llamada === 1) return respuestaSesion();
      if (llamada === 2) return respuesta(new SyntaxError('JSON secreto'));
      return respuestaCierre();
    });
    await assert.rejects(conector().leerDatos(), (error) => {
      assert.equal(error.message, 'GLPI devolvió JSON inválido');
      assert.doesNotMatch(error.message, /JSON secreto|secret-test/);
      return true;
    });
  });

  it('rechaza respuestas con estructura incompleta y cierra la sesión', async (t) => {
    let llamada = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      llamada += 1;
      if (llamada === 1) return respuestaSesion();
      if (llamada === 2) return respuesta([{ id: 1 }], 200, {
        'Content-Range': '0-0/1', 'Accept-Range': 'Ticket 50',
      });
      return respuestaCierre();
    });

    await assert.rejects(conector().leerDatos(), /ticket sin id o name/);
    assert.equal(llamada, 3);
  });

  it('conserva el comportamiento del modo mock', () => {
    const script = `
      import { ConectorGlpi } from ${JSON.stringify(new URL('../src/conectores/ConectorGlpi.js', import.meta.url).href)};
      const tickets = await new ConectorGlpi({ nombre: 'glpi', urlApi: '' }).leerDatos();
      if (!Array.isArray(tickets) || tickets.length === 0 || !('tecnico_asignado' in tickets[0])) process.exit(1);
    `;
    const resultado = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '', USAR_MOCKS: 'true', MOCK_FALLA_FUENTE: '' },
    });
    assert.equal(resultado.status, 0, resultado.stderr);
  });
});
