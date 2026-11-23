import { config } from '../config.js';
import { Conector } from './Conector.js';

const LIMITE_PAGINA = 100;
const fechaIso = (valor) => {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new Error('GitLab devolvió una fecha inválida');
  return fecha.toISOString();
};

/** Lee commits, merge requests y pipelines por Desarrollador desde GitLab (RF-03). */
export class ConectorGitlab extends Conector {
  async leerDatos(desde, desarrolladores = []) {
    if (config.usarMocks) {
      const { eventos } = await this.leerMock('gitlab.json');
      return eventos;
    }

    const { token, projectIds } = config.fuentes.gitlab;
    if (!token) throw new Error('Falta configurar GITLAB_TOKEN');
    if (!this.fuente.urlApi) throw new Error('Falta configurar GITLAB_URL');
    if (!projectIds?.length) throw new Error('Falta configurar GITLAB_PROJECT_IDS');

    const urlBase = this.fuente.urlApi.replace(/\/+$/, '');
    const origenGitlab = new URL(urlBase).origin;
    const apiBase = urlBase.endsWith('/api/v4') ? urlBase : `${urlBase}/api/v4`;
    const usuariosPorCorreo = this.#crearIndiceCorreos(desarrolladores);
    const eventos = new Map();

    for (const projectId of projectIds) {
      const proyecto = encodeURIComponent(projectId);
      const parametrosCommit = { all: 'true' };
      if (desde) parametrosCommit.since = fechaIso(desde);
      const commits = await this.#leerPaginas(`${apiBase}/projects/${proyecto}/repository/commits`, parametrosCommit, token, origenGitlab);

      for (const commit of commits) {
        this.#validarCommit(commit);
        const refs = await this.#leerPaginas(
          `${apiBase}/projects/${proyecto}/repository/commits/${encodeURIComponent(commit.id)}/refs`,
          { type: 'branch' },
          token,
          origenGitlab,
        );
        const ramas = new Set();
        for (const ref of refs) {
          if (!ref || typeof ref.name !== 'string' || (ref.type && ref.type !== 'branch')) {
            throw new Error('GitLab devolvió una referencia de commit inválida');
          }
          ramas.add(ref.name);
        }

        for (const rama of ramas) {
          const evento = {
            id: `gitlab:${projectId}:commit:${commit.id}:branch:${rama}`,
            idOrigen: commit.id,
            tipo: 'commit',
            rama,
            titulo: typeof commit.title === 'string' ? commit.title : undefined,
            autor: this.#usuarioPorCorreo(commit.author_email, usuariosPorCorreo),
            fecha: fechaIso(commit.committed_date),
            ...(commit.status === undefined ? {} : { estado: commit.status }),
          };
          eventos.set(evento.id, evento);
        }
      }

      const parametrosMr = { scope: 'all', state: 'all' };
      if (desde) parametrosMr.updated_after = fechaIso(desde);
      const mergeRequests = await this.#leerPaginas(
        `${apiBase}/projects/${proyecto}/merge_requests`,
        parametrosMr,
        token,
        origenGitlab,
      );
      for (const mr of mergeRequests) {
        if (!mr || mr.iid === undefined || typeof mr.source_branch !== 'string') {
          throw new Error('GitLab devolvió una merge request inválida');
        }
        const evento = {
          id: `gitlab:${projectId}:merge_request:${mr.iid}`,
          idOrigen: mr.iid,
          tipo: 'merge_request',
          rama: mr.source_branch,
          titulo: typeof mr.title === 'string' ? mr.title : undefined,
          autor: typeof mr.author?.username === 'string' ? mr.author.username : null,
          fecha: fechaIso(mr.updated_at ?? mr.created_at),
          estado: mr.state ?? null,
        };
        eventos.set(evento.id, evento);
      }

      const parametrosPipeline = {};
      if (desde) parametrosPipeline.updated_after = fechaIso(desde);
      const pipelines = await this.#leerPaginas(
        `${apiBase}/projects/${proyecto}/pipelines`,
        parametrosPipeline,
        token,
        origenGitlab,
      );
      for (const pipeline of pipelines) {
        if (!pipeline || pipeline.id === undefined || typeof pipeline.ref !== 'string') {
          throw new Error('GitLab devolvió un pipeline inválido');
        }
        const evento = {
          id: `gitlab:${projectId}:pipeline:${pipeline.id}`,
          idOrigen: pipeline.id,
          tipo: 'pipeline',
          rama: pipeline.ref,
          titulo: typeof pipeline.name === 'string' ? pipeline.name : undefined,
          autor: typeof pipeline.user?.username === 'string' ? pipeline.user.username : null,
          fecha: fechaIso(pipeline.updated_at ?? pipeline.created_at),
          estado: pipeline.status ?? null,
        };
        eventos.set(evento.id, evento);
      }
    }

    return [...eventos.values()];
  }

  #crearIndiceCorreos(desarrolladores) {
    const indice = new Map();
    for (const desarrollador of desarrolladores) {
      const correo = desarrollador.correo?.trim().toLowerCase();
      if (!correo) continue;
      const coincidencias = indice.get(correo) ?? [];
      coincidencias.push(desarrollador);
      indice.set(correo, coincidencias);
    }
    return indice;
  }

  #usuarioPorCorreo(correo, indice) {
    if (typeof correo !== 'string') return null;
    const coincidencias = indice.get(correo.trim().toLowerCase()) ?? [];
    if (coincidencias.length !== 1 || typeof coincidencias[0].usuarioGitlab !== 'string') return null;
    return coincidencias[0].usuarioGitlab;
  }

  #validarCommit(commit) {
    if (!commit || typeof commit.id !== 'string' || !commit.id || typeof commit.committed_date !== 'string') {
      throw new Error('GitLab devolvió un commit inválido');
    }
    fechaIso(commit.committed_date);
  }

  async #leerPaginas(urlInicial, parametros, token, origenPermitido) {
    const url = new URL(urlInicial);
    if (url.origin !== origenPermitido) {
      throw new Error('GitLab devolvió un enlace de paginación a un origen no permitido');
    }
    for (const [clave, valor] of Object.entries(parametros)) url.searchParams.set(clave, valor);
    url.searchParams.set('per_page', String(LIMITE_PAGINA));
    url.searchParams.set('page', '1');

    const registros = [];
    const visitadas = new Set();
    let siguiente = url;
    while (siguiente) {
      if (siguiente.origin !== origenPermitido) {
        throw new Error('GitLab devolvió un enlace de paginación a un origen no permitido');
      }
      const actual = siguiente.toString();
      if (visitadas.has(actual)) throw new Error('GitLab repitió un enlace de paginación');
      visitadas.add(actual);
      const respuesta = await this.#getJson(siguiente, token);
      if (!Array.isArray(respuesta.datos)) {
        throw new Error('GitLab devolvió JSON inválido: se esperaba una lista');
      }
      registros.push(...respuesta.datos);
      siguiente = this.#siguientePagina(respuesta.headers, siguiente, origenPermitido);
    }
    return registros;
  }

  async #getJson(url, token) {
    let respuesta;
    try {
      respuesta = await fetch(url, {
        headers: { 'PRIVATE-TOKEN': token, Accept: 'application/json' },
        redirect: 'error',
      });
    } catch {
      throw new Error('No se pudo conectar con GitLab');
    }
    if (!respuesta.ok) throw new Error(`GitLab respondió HTTP ${respuesta.status}`);
    try {
      return { datos: await respuesta.json(), headers: respuesta.headers };
    } catch {
      throw new Error('GitLab devolvió JSON inválido');
    }
  }

  #siguientePagina(headers, urlActual, origenPermitido) {
    const enlace = headers?.get?.('link') ?? headers?.get?.('Link');
    if (enlace) {
      const siguiente = enlace.split(/,\s*(?=<)/).map((parte) => parte.match(/<([^>]+)>\s*;\s*rel="?next"?/i)).find(Boolean);
      if (siguiente) {
        const urlSiguiente = new URL(siguiente[1], urlActual);
        if (urlSiguiente.origin !== origenPermitido) {
          throw new Error('GitLab devolvió un enlace de paginación a un origen no permitido');
        }
        return urlSiguiente;
      }
    }
    const pagina = headers?.get?.('x-next-page') ?? headers?.get?.('X-Next-Page');
    if (pagina) {
      const siguiente = new URL(urlActual);
      siguiente.searchParams.set('page', pagina);
      return siguiente;
    }
    return null;
  }
}
