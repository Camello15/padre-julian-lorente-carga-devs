import { config } from '../config.js';
import { Conector } from './Conector.js';

// La primera respuesta indica el máximo real de rango mediante Accept-Range.
const RANGO_INICIAL = 1;

/** Lee los incidentes asignados desde la mesa de ayuda GLPI (RF-04). */
export class ConectorGlpi extends Conector {
  async leerDatos(_desde) {
    if (config.usarMocks) {
      const { tickets } = await this.leerMock('glpi.json');
      return tickets;
    }

    const { appToken, userToken } = config.fuentes.glpi;
    if (!userToken) throw new Error('Falta configurar GLPI_USER_TOKEN');
    if (!appToken) throw new Error('Falta configurar GLPI_APP_TOKEN');
    if (!this.fuente.urlApi) throw new Error('Falta configurar GLPI_URL');

    const base = this.#apiBase(this.fuente.urlApi);
    const encabezadosIniciales = {
      'App-Token': appToken,
      Authorization: `user_token ${userToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const inicio = await this.#getJson(`${base}/initSession`, encabezadosIniciales);
    if (!inicio || typeof inicio.session_token !== 'string' || inicio.session_token.length === 0) {
      throw new Error('Respuesta JSON inválida de GLPI: falta session_token');
    }

    const sessionToken = inicio.session_token;
    const encabezadosSesion = {
      'App-Token': appToken,
      'Session-Token': sessionToken,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    let datos;
    let errorLectura;
    let lecturaFallida = false;
    try {
      datos = await this.#leerTickets(base, encabezadosSesion);
    } catch (error) {
      lecturaFallida = true;
      errorLectura = error;
    }

    let falloCierre = false;
    try {
      await this.#getJson(`${base}/killSession`, encabezadosSesion, { requiereJson: false });
    } catch {
      falloCierre = true;
    }

    if (lecturaFallida) throw errorLectura;
    if (falloCierre) throw new Error('No se pudo cerrar la sesión de GLPI');
    return datos;
  }

  #apiBase(urlConfigurada) {
    let url;
    try {
      url = new URL(urlConfigurada);
    } catch {
      throw new Error('GLPI_URL debe ser una URL válida');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('GLPI_URL no debe contener credenciales ni parámetros');
    }
    const rutaBase = url.pathname.replace(/\/+$/, '').replace(/\/apirest\.php$/i, '');
    return `${url.origin}${rutaBase}/apirest.php`;
  }

  async #leerTickets(base, encabezados) {
    const tickets = [];
    let inicio = 0;
    let totalEsperado;
    let limite = RANGO_INICIAL;

    while (totalEsperado === undefined || inicio < totalEsperado) {
      const finSolicitado = inicio + limite - 1;
      const url = new URL(`${base}/Ticket/`);
      url.searchParams.set('range', `${inicio}-${finSolicitado}`);
      const respuesta = await this.#get(`${url}`, encabezados);
      const pagina = await this.#parseJson(respuesta);
      if (!Array.isArray(pagina)) {
        throw new Error('Respuesta JSON inválida de GLPI: se esperaba una lista de tickets');
      }

      const maximoAceptado = this.#leerLimite(respuesta.headers.get('Accept-Range'));
      const rango = this.#leerRango(respuesta.headers.get('Content-Range'));
      if (rango.inicio !== inicio) {
        throw new Error('Respuesta de GLPI con Content-Range inesperado');
      }
      if (totalEsperado !== undefined && rango.total !== totalEsperado) {
        throw new Error('Respuesta de GLPI con total de registros inconsistente');
      }
      if (rango.total === 0) {
        if (inicio !== 0 || pagina.length !== 0) {
          throw new Error('Respuesta JSON inválida de GLPI: rango vacío inconsistente');
        }
        return tickets;
      }

      const cantidadRango = rango.fin - rango.inicio + 1;
      if (cantidadRango < 1 || cantidadRango > limite || pagina.length !== cantidadRango) {
        throw new Error('Respuesta JSON inválida de GLPI: contenido incompatible con Content-Range');
      }
      if (maximoAceptado < 1) throw new Error('Respuesta de GLPI con Accept-Range inválido');
      for (const ticket of pagina) {
        if (!ticket || typeof ticket !== 'object' || ticket.id === undefined || ticket.id === null || typeof ticket.name !== 'string') {
          throw new Error('Respuesta JSON inválida de GLPI: ticket sin id o name');
        }
        tickets.push({
          id: ticket.id,
          name: ticket.name,
          // GLPI entrega las asignaciones como relaciones; no se deduce un username a partir de un ID.
          tecnico_asignado: null,
        });
      }

      totalEsperado = rango.total;
      limite = maximoAceptado;
      inicio = rango.fin + 1;
    }
    return tickets;
  }

  #leerLimite(encabezado) {
    const coincidencia = String(encabezado ?? '').match(/(?:^|\s)(\d+)\s*$/);
    if (!coincidencia) throw new Error('Respuesta de GLPI sin Accept-Range válido');
    const limite = Number(coincidencia[1]);
    if (!Number.isSafeInteger(limite) || limite < 1) throw new Error('Respuesta de GLPI con Accept-Range inválido');
    return limite;
  }

  #leerRango(encabezado) {
    const coincidencia = String(encabezado ?? '').match(/^(\d+)-(\d+)\/(\d+)$/);
    if (!coincidencia) throw new Error('Respuesta de GLPI sin Content-Range válido');
    const [, inicioTexto, finTexto, totalTexto] = coincidencia;
    const valores = [inicioTexto, finTexto, totalTexto].map(Number);
    if (!valores.every(Number.isSafeInteger)) throw new Error('Respuesta de GLPI con Content-Range inválido');
    const [inicio, fin, total] = valores;
    if (fin < inicio || total < 0 || (total > 0 && fin >= total)) {
      throw new Error('Respuesta de GLPI con Content-Range inválido');
    }
    return { inicio, fin, total };
  }

  async #getJson(url, encabezados, opciones = {}) {
    const respuesta = await this.#get(url, encabezados);
    return opciones.requiereJson === false ? null : this.#parseJson(respuesta);
  }

  async #get(url, encabezados) {
    let respuesta;
    try {
      respuesta = await fetch(url, { headers: encabezados, redirect: 'error' });
    } catch {
      throw new Error('No se pudo conectar con GLPI');
    }
    if (!respuesta.ok) throw new Error(`GLPI respondió HTTP ${respuesta.status}`);
    return respuesta;
  }

  async #parseJson(respuesta) {
    try {
      return await respuesta.json();
    } catch {
      throw new Error('GLPI devolvió JSON inválido');
    }
  }
}
