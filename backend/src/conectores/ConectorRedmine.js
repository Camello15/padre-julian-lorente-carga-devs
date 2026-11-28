import { config } from '../config.js';
import { Conector } from './Conector.js';

const LIMITE_PAGINA = 100;
const codigoErrorHttp = (status) => `Redmine respondió HTTP ${status}`;

/** Lee peticiones (POA, REC, Iniciativa, Incidente) y su Etapa desde RedMine (RF-02). */
export class ConectorRedmine extends Conector {
  constructor(fuente) {
    super(fuente);
    this.identificadoresProyecto = new Map();
  }

  async leerDatos(desde) {
    if (config.usarMocks) {
      const { issues } = await this.leerMock('redmine.json');
      return issues;
    }

    const apiKey = config.fuentes.redmine.apiKey;
    if (!apiKey) throw new Error('Falta configurar REDMINE_API_KEY');
    if (!this.fuente.urlApi) throw new Error('Falta configurar REDMINE_URL');

    const base = this.fuente.urlApi.replace(/\/+$/, '');
    const registros = new Map();
    let offset = 0;
    let haySiguiente;

    do {
      const parametros = new URLSearchParams({ status_id: '*', limit: String(LIMITE_PAGINA), offset: String(offset) });
      if (desde) {
        const fecha = desde instanceof Date ? desde.toISOString() : new Date(desde).toISOString();
        parametros.set('updated_on', `>=${fecha}`);
      }
      const url = `${base}/issues.json?${parametros.toString()}`;
      const pagina = await this.#getJson(url, apiKey);
      if (!pagina || typeof pagina !== 'object' || !Array.isArray(pagina.issues) || !Number.isInteger(pagina.total_count) || pagina.total_count < 0) {
        throw new Error('Respuesta JSON inválida de Redmine: se esperaba issues y total_count');
      }
      if (pagina.issues.length === 0 && offset < pagina.total_count) {
        throw new Error('Respuesta JSON inválida de Redmine: página vacía antes de total_count');
      }
      for (const issue of pagina.issues) {
        if (!issue || issue.id === undefined || issue.id === null) {
          throw new Error('Respuesta JSON inválida de Redmine: incidencia sin id');
        }
        registros.set(String(issue.id), issue);
      }
      offset += pagina.issues.length;
      haySiguiente = offset < pagina.total_count;
    } while (haySiguiente);

    const issues = [...registros.values()];
    await this.#completarIdentificadoresProyecto(issues, base, apiKey);
    return issues;
  }

  async #getJson(url, apiKey) {
    let respuesta;
    try {
      respuesta = await fetch(url, { headers: { 'X-Redmine-API-Key': apiKey, Accept: 'application/json' } });
    } catch {
      throw new Error('No se pudo conectar con Redmine');
    }
    if (!respuesta.ok) throw new Error(codigoErrorHttp(respuesta.status));
    try {
      return await respuesta.json();
    } catch {
      throw new Error('Redmine devolvió JSON inválido');
    }
  }

  async #completarIdentificadoresProyecto(issues, base, apiKey) {
    const porId = new Map();
    for (const issue of issues) {
      if (issue.project?.identifier) continue;
      const id = issue.project?.id;
      if (id === undefined || id === null) {
        throw new Error(`Incidencia Redmine ${issue.id} no contiene identificador ni id de proyecto`);
      }
      if (!this.identificadoresProyecto.has(String(id))) {
        porId.set(String(id), id);
      }
    }

    for (const [clave, id] of porId) {
      const proyecto = await this.#getJson(`${base}/projects/${encodeURIComponent(id)}.json`, apiKey);
      if (typeof proyecto.project?.identifier !== 'string' || proyecto.project.identifier.length === 0) {
        throw new Error(`Respuesta JSON inválida de Redmine: proyecto ${id} sin identifier`);
      }
      this.identificadoresProyecto.set(clave, proyecto.project.identifier);
    }

    for (const issue of issues) {
      if (!issue.project?.identifier && issue.project?.id !== undefined && issue.project?.id !== null) {
        const identifier = this.identificadoresProyecto.get(String(issue.project.id));
        if (!identifier) throw new Error(`No se pudo resolver el identificador del proyecto Redmine ${issue.project.id}`);
        issue.project = { ...issue.project, identifier };
      }
    }
  }
}
