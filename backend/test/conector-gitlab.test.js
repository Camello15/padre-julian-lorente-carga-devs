import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';

process.env.USAR_MOCKS = 'false';
process.env.GITLAB_URL = 'https://gitlab.example.test';
process.env.GITLAB_TOKEN = 'test-gitlab-token';
process.env.GITLAB_PROJECT_IDS = '17, 18';

const { ConectorGitlab } = await import('../src/conectores/ConectorGitlab.js');
const { config } = await import('../src/config.js');
const desarrolladores = JSON.parse(readFileSync(new URL('../mocks/desarrolladores.json', import.meta.url), 'utf8'));
const conector = () => new ConectorGitlab({ nombre: 'gitlab', urlApi: process.env.GITLAB_URL, activa: true });
const respuesta = (cuerpo, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (nombre) => headers[nombre.toLowerCase()] ?? null },
  json: async () => cuerpo,
});
const enlaceSiguiente = (url) => {
  const siguiente = new URL(url);
  siguiente.searchParams.set('page', '2');
  return `<${siguiente}>; rel="next"`;
};

after(() => {
  delete process.env.USAR_MOCKS;
  delete process.env.GITLAB_URL;
  delete process.env.GITLAB_TOKEN;
  delete process.env.GITLAB_PROJECT_IDS;
});

describe('ConectorGitlab API', () => {
  it('lee las listas de proyectos configuradas desde GITLAB_PROJECT_IDS', () => {
    assert.deepEqual(config.fuentes.gitlab.projectIds, ['17', '18']);
  });

  it('consulta los tres endpoints, pagina, resuelve ramas múltiples y adapta autores', async (t) => {
    const llamadas = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      const parsed = new URL(url);
      llamadas.push({ url: parsed, options });
      const ruta = parsed.pathname;
      if (ruta.endsWith('/repository/commits')) {
        if (parsed.pathname.includes('/projects/18/')) return respuesta([]);
        if (parsed.searchParams.get('page') === '1') {
          return respuesta([{
            id: 'sha-one', title: 'Commit INC-2026-031', author_email: 'ATORRES@EJEMPLO.TEST',
            committed_date: '2026-11-22T10:00:00Z',
          }], 200, { link: enlaceSiguiente(parsed) });
        }
        return respuesta([{
          id: 'sha-two', title: 'Otro commit', author_email: 'unknown@example.test',
          committed_date: '2026-11-22T10:01:00Z',
        }]);
      }
      if (ruta.endsWith('/repository/commits/sha-one/refs')) {
        return respuesta([{ type: 'branch', name: 'feature/INC-2026-031' }, { type: 'branch', name: 'release/INC-2026-031' }]);
      }
      if (ruta.endsWith('/repository/commits/sha-two/refs')) return respuesta([]);
      if (ruta.endsWith('/merge_requests')) {
        if (parsed.pathname.includes('/projects/18/')) return respuesta([]);
        return respuesta([{
          iid: 4, source_branch: 'feature/REC-2026-014', title: 'MR REC-2026-014',
          author: { username: 'mr-author' }, updated_at: '2026-11-22T10:02:00Z', state: 'opened',
        }]);
      }
      if (ruta.endsWith('/pipelines')) {
        if (parsed.pathname.includes('/projects/18/')) return respuesta([]);
        return respuesta([
          { id: 21, ref: 'hotfix/INC-2026-031', name: 'Pipeline INC-2026-031', status: 'success', user: { username: 'pipe-user' }, updated_at: '2026-11-22T10:03:00Z' },
          { id: 22, ref: 'feature/sin-autor', status: 'failed', updated_at: '2026-11-22T10:04:00Z' },
        ]);
      }
      throw new Error(`Ruta de prueba inesperada: ${ruta}`);
    });

    const eventos = await conector().leerDatos(new Date('2026-11-22T09:00:00Z'), desarrolladores);

    assert.equal(eventos.length, 5);
    const commits = eventos.filter((evento) => evento.tipo === 'commit');
    assert.deepEqual(commits.map((evento) => evento.rama).sort(), ['feature/INC-2026-031', 'release/INC-2026-031']);
    assert.ok(commits.every((evento) => evento.autor === 'atorres'));
    assert.ok(commits.every((evento) => evento.id.startsWith('gitlab:17:commit:sha-one:branch:')));
    assert.equal(eventos.find((evento) => evento.tipo === 'merge_request').autor, 'mr-author');
    assert.equal(eventos.find((evento) => evento.tipo === 'pipeline' && evento.idOrigen === 21).autor, 'pipe-user');
    assert.equal(eventos.find((evento) => evento.tipo === 'pipeline' && evento.idOrigen === 22).autor, null);
    assert.ok(eventos.every((evento) => evento.id.startsWith('gitlab:')));

    const commitsPage1 = llamadas.find(({ url }) => url.pathname.endsWith('/repository/commits'));
    assert.equal(commitsPage1.url.searchParams.get('all'), 'true');
    assert.equal(commitsPage1.url.searchParams.get('since'), '2026-11-22T09:00:00.000Z');
    assert.equal(commitsPage1.url.searchParams.get('per_page'), '100');
    assert.equal(llamadas.filter(({ url }) => url.pathname.endsWith('/repository/commits')).length, 3);
    assert.ok(llamadas.some(({ url }) => url.pathname.endsWith('/merge_requests') && url.searchParams.get('updated_after')));
    assert.ok(llamadas.some(({ url }) => url.pathname.endsWith('/pipelines') && url.searchParams.get('updated_after')));
    assert.ok(llamadas.every(({ url, options }) => !url.href.includes('test-gitlab-token') && options.headers['PRIVATE-TOKEN'] === 'test-gitlab-token'));
  });

  it('genera IDs estables que distinguen proyecto, tipo e identificador de origen', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/repository/commits')) return respuesta([]);
      if (parsed.pathname.endsWith('/merge_requests')) return respuesta([]);
      if (parsed.pathname.endsWith('/pipelines')) {
        return respuesta([{ id: 5, ref: 'main', status: 'success', created_at: '2026-11-22T10:00:00Z' }]);
      }
      throw new Error('No se esperaban referencias de commits');
    });

    const eventos = await conector().leerDatos(null, desarrolladores);
    assert.deepEqual(eventos.map((evento) => evento.id), [
      'gitlab:17:pipeline:5',
      'gitlab:18:pipeline:5',
    ]);
  });

  it('no asigna autor si el correo no coincide o es ambiguo', async (t) => {
    const devsAmbiguos = [
      ...desarrolladores,
      { id: 'dev-3', correo: 'atorres@ejemplo.test', usuarioGitlab: 'other-dev' },
    ];
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/repository/commits')) {
        return respuesta([{ id: 'same-sha', author_email: 'atorres@ejemplo.test', committed_date: '2026-11-22T10:00:00Z' }]);
      }
      if (parsed.pathname.endsWith('/refs')) return respuesta([{ type: 'branch', name: 'feature/INC-2026-031' }]);
      return respuesta([]);
    });

    const eventos = await conector().leerDatos(null, devsAmbiguos);
    assert.equal(eventos.find((evento) => evento.tipo === 'commit').autor, null);
  });

  it('falla de forma segura ante respuestas HTTP y nunca incluye token o cuerpo en el error', async (t) => {
    let estado = 401;
    t.mock.method(globalThis, 'fetch', async () => respuesta({ message: 'detalle que no debe propagarse' }, estado));
    for (const status of [401, 403, 404, 429, 500, 503]) {
      estado = status;
      await assert.rejects(conector().leerDatos(null, desarrolladores), (error) => {
        assert.match(error.message, new RegExp(`HTTP ${status}`));
        assert.doesNotMatch(error.message, /detalle que no debe propagarse|test-gitlab-token/);
        return true;
      });
    }
  });

  it('no devuelve deltas parciales si falla una página después de otra válida', async (t) => {
    let llamada = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/repository/commits') && llamada++ === 0) {
        return respuesta([{ id: 'sha-page-1', committed_date: '2026-11-22T10:00:00Z' }], 200, { link: enlaceSiguiente(parsed) });
      }
      return respuesta({ message: 'detalle sensível privado' }, 500);
    });
    await assert.rejects(conector().leerDatos(null, desarrolladores), (error) => {
      assert.match(error.message, /HTTP 500/);
      assert.doesNotMatch(error.message, /detalle sensível privado|test-gitlab-token/);
      return true;
    });
    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('fallo de red con posible detalle sensible'); });
    await assert.rejects(conector().leerDatos(null, desarrolladores), /No se pudo conectar con GitLab/);
    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('json'); } }));
    await assert.rejects(conector().leerDatos(null, desarrolladores), /JSON inválido/);
  });

  it('rechaza un enlace Link a otro origen sin enviar el token al dominio externo', async (t) => {
    const urlsSolicitadas = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      const parsed = new URL(url);
      urlsSolicitadas.push(parsed);
      return respuesta([], 200, { link: '<https://evil.example.test/api/v4/steal?page=2>; rel="next"' });
    });

    await assert.rejects(conector().leerDatos(null, desarrolladores), (error) => {
      assert.match(error.message, /origen no permitido/);
      assert.doesNotMatch(error.message, /test-gitlab-token/);
      return true;
    });

    assert.equal(urlsSolicitadas.length, 1);
    assert.equal(urlsSolicitadas[0].origin, 'https://gitlab.example.test');
    assert.ok(urlsSolicitadas.every((url) => url.origin !== 'https://evil.example.test'));
  });
});
