import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

process.env.USAR_MOCKS = 'false';
process.env.REDMINE_API_KEY = 'unit-test-secret';

const { ConectorRedmine } = await import('../src/conectores/ConectorRedmine.js');
const issue = (id, titulo = `Incidencia ${id}`) => ({
  id,
  subject: titulo,
  tracker: { name: 'Incidente' },
  status: { is_closed: false },
  assigned_to: { id: 11 },
  project: { id: 7, name: 'Proyecto', identifier: 'proyecto' },
  custom_fields: [
    { name: 'Código', value: 'INC-2026-001' },
    { name: 'Etapa', value: 'Desarrollo' },
    { name: 'Módulo del core', value: ['Cajas'] },
  ],
});
const respuesta = (cuerpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});
const conector = () => new ConectorRedmine({ nombre: 'redmine', urlApi: 'https://redmine.example.test' });

after(() => {
  delete process.env.USAR_MOCKS;
  delete process.env.REDMINE_API_KEY;
});

describe('ConectorRedmine API', () => {
  it('realiza la primera lectura completa con status_id=* y limit 100', async (t) => {
    const llamadas = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      llamadas.push({ url: new URL(url), options });
      return respuesta({ issues: [issue(1)], total_count: 1, offset: 0, limit: 100 });
    });

    const datos = await conector().leerDatos(null);

    assert.equal(datos.length, 1);
    assert.equal(llamadas[0].url.pathname, '/issues.json');
    assert.equal(llamadas[0].url.searchParams.get('status_id'), '*');
    assert.equal(llamadas[0].url.searchParams.get('limit'), '100');
    assert.equal(llamadas[0].url.searchParams.has('updated_on'), false);
  });

  it('pagina usando offset y consolida incidencias repetidas por ID', async (t) => {
    const offsets = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      offsets.push(parsed.searchParams.get('offset'));
      if (offsets.length === 1) return respuesta({ issues: [issue(1), issue(2, 'viejo')], total_count: 3, offset: 0 });
      return respuesta({ issues: [issue(2, 'actualizado'), issue(3)], total_count: 3, offset: 100 });
    });

    const datos = await conector().leerDatos();

    assert.deepEqual(offsets, ['0', '2']);
    assert.equal(datos.length, 3);
    assert.equal(datos.find((item) => item.id === 2).subject, 'actualizado');
  });

  it('continúa la paginación cuando Redmine devuelve menos que el límite solicitado', async (t) => {
    const offsets = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      offsets.push(parsed.searchParams.get('offset'));
      return offsets.length === 1
        ? respuesta({ issues: [issue(1), issue(2)], total_count: 3, offset: 0, limit: 100 })
        : respuesta({ issues: [issue(3)], total_count: 3, offset: 2, limit: 100 });
    });

    const datos = await conector().leerDatos();

    assert.deepEqual(offsets, ['0', '2']);
    assert.equal(datos.length, 3);
  });

  it('envía updated_on con operador >= codificado por URLSearchParams', async (t) => {
    let urlUsada;
    t.mock.method(globalThis, 'fetch', async (url) => {
      urlUsada = String(url);
      return respuesta({ issues: [], total_count: 0, offset: 0 });
    });

    await conector().leerDatos(new Date('2026-11-22T10:30:00.000Z'));

    const url = new URL(urlUsada);
    assert.equal(url.searchParams.get('updated_on'), '>=2026-11-22T10:30:00.000Z');
    assert.match(urlUsada, /updated_on=%3E%3D/);
  });

  it('envía el token en encabezado y nunca en la URL', async (t) => {
    let llamada;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      llamada = { url: String(url), options };
      return respuesta({ issues: [], total_count: 0, offset: 0 });
    });

    await conector().leerDatos();

    assert.equal(llamada.options.headers['X-Redmine-API-Key'], 'unit-test-secret');
    assert.equal(llamada.url.includes('unit-test-secret'), false);
  });

  it('no devuelve resultados si una página falla', async (t) => {
    let numero = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      numero += 1;
      return numero === 1
        ? respuesta({ issues: [issue(1)], total_count: 2, offset: 0 })
        : respuesta({ errors: ['fallo interno'] }, 500);
    });

    await assert.rejects(conector().leerDatos(), /HTTP 500/);
  });

  it('propaga errores HTTP de autenticación, permisos, ruta, límite y servidor sin filtrar respuesta', async (t) => {
    let statusActual = 401;
    t.mock.method(globalThis, 'fetch', async () => respuesta({ errors: ['detalle privado'] }, statusActual));
    for (const status of [401, 403, 404, 429, 503]) {
      statusActual = status;
      await assert.rejects(conector().leerDatos(), (error) => {
        assert.match(error.message, new RegExp(`HTTP ${status}`));
        assert.doesNotMatch(error.message, /detalle privado|unit-test-secret/);
        return true;
      });
    }
  });

  it('maneja errores de red y JSON inválido sin convertirlos en listas vacías', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('detalle de red que podría incluir secretos'); });
    await assert.rejects(conector().leerDatos(), /No se pudo conectar con Redmine/);
    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('json'); } }));
    await assert.rejects(conector().leerDatos(), /JSON inválido/);
  });

  it('resuelve project.identifier por la API de proyectos cuando el issue solo incluye project.id', async (t) => {
    let llamadas = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
      llamadas += 1;
      if (String(url).includes('/issues.json')) {
        return respuesta({ issues: [{ ...issue(1), project: { id: 7, name: 'Proyecto' } }], total_count: 1, offset: 0 });
      }
      return respuesta({ project: { id: 7, name: 'Proyecto', identifier: 'proyecto' } });
    });

    const datos = await conector().leerDatos();
    assert.equal(datos[0].project.identifier, 'proyecto');
    assert.equal(llamadas, 2);
  });

  it('devuelve registros compatibles con el normalizador', async (t) => {
    const { unificar } = await import('../src/sincronizacion/normalizador.js');
    t.mock.method(globalThis, 'fetch', async () => respuesta({ issues: [issue(42)], total_count: 1, offset: 0 }));

    const resultado = unificar({ redmine: await conector().leerDatos() }, []);
    assert.equal(resultado.peticiones[0].codigo, 'INC-2026-001');
    assert.equal(resultado.peticiones[0].proyectoId, 'proyecto');
    assert.deepEqual(resultado.modulosConCambios, []);
  });
});

