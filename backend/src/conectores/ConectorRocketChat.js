import { config } from '../config.js';
import { Conector } from './Conector.js';

const CANTIDAD_POR_PAGINA = 50;

/** Lee notificaciones relevantes de los canales de Rocket Chat (RF-05). */
export class ConectorRocketChat extends Conector {
  constructor(fuente) {
    super(fuente);
    this.identidadesMensajes = new WeakMap();
    this.modoMock = config.usarMocks;
  }

  async leerDatos(desde) {
    if (config.usarMocks) {
      const { mensajes } = await this.leerMock('rocketchat.json');
      return mensajes;
    }

    const { url, userId, token, canalesLectura } = config.fuentes.rocketchat;
    if (!url) throw new Error('Falta configurar ROCKETCHAT_URL');
    if (!userId) throw new Error('Falta configurar ROCKETCHAT_USER_ID');
    if (!token) throw new Error('Falta configurar ROCKETCHAT_TOKEN');
    if (!canalesLectura.length) throw new Error('Falta configurar ROCKETCHAT_CANALES_LECTURA');

    const base = this.#apiBase(url);
    const encabezados = {
      'X-Auth-Token': token,
      'X-User-Id': userId,
      Accept: 'application/json',
    };
    const mensajesPorClave = new Map();
    const salasLeidas = new Set();

    for (const nombreSolicitado of canalesLectura) {
      const sala = await this.#resolverSala(base, nombreSolicitado, encabezados);
      if (salasLeidas.has(sala.id)) continue;
      salasLeidas.add(sala.id);

      const historial = await this.#leerHistorial(base, sala, encabezados, desde);
      for (const mensaje of historial) {
        const clave = JSON.stringify([mensaje.rid, mensaje._id]);
        if (mensajesPorClave.has(clave)) continue;
        const adaptado = {
          canal: sala.nombre,
          texto: mensaje.msg,
          fecha: mensaje.ts,
        };
        this.identidadesMensajes.set(adaptado, { rid: mensaje.rid, id: mensaje._id });
        mensajesPorClave.set(clave, adaptado);
      }
    }

    return [...mensajesPorClave.values()];
  }

  identidadMensaje(mensaje) {
    const identidad = this.identidadesMensajes.get(mensaje);
    if (!identidad || !this.#identidadValida(identidad)) {
      throw new Error('Mensaje de Rocket.Chat sin identidad interna válida');
    }
    return JSON.stringify([identidad.rid, identidad.id]);
  }

  exportarMetadatos(mensajes) {
    if (!Array.isArray(mensajes)) throw new Error('Mensajes de Rocket.Chat inválidos para exportar metadatos');
    return mensajes.map((mensaje) => {
      const identidad = this.identidadesMensajes.get(mensaje);
      if (!identidad || !this.#identidadValida(identidad)) {
        throw new Error('Mensaje de Rocket.Chat sin identidad interna válida');
      }
      return { rid: identidad.rid, id: identidad.id };
    });
  }

  rehidratarMetadatos(mensajes, metadatos) {
    if (!Array.isArray(mensajes) || !Array.isArray(metadatos) || metadatos.length !== mensajes.length) {
      throw new Error('Metadatos de snapshot Rocket.Chat inválidos');
    }
    mensajes.forEach((mensaje, indice) => {
      const identidad = metadatos[indice];
      if (!identidad || !this.#identidadValida(identidad)) {
        throw new Error('Identidad de mensaje Rocket.Chat inválida en snapshot');
      }
      this.identidadesMensajes.set(mensaje, { rid: identidad.rid, id: identidad.id });
    });
  }

  #identidadValida(identidad) {
    return typeof identidad?.rid === 'string' && identidad.rid.trim() !== ''
      && typeof identidad?.id === 'string' && identidad.id.trim() !== '';
  }

  #apiBase(urlConfigurada) {
    let url;
    try {
      url = new URL(urlConfigurada);
    } catch {
      throw new Error('ROCKETCHAT_URL debe ser una URL válida');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('ROCKETCHAT_URL no debe contener credenciales ni parámetros');
    }
    const rutaBase = url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    return `${url.origin}${rutaBase}/api/v1`;
  }

  async #resolverSala(base, nombre, encabezados) {
    const url = new URL(`${base}/rooms.info`);
    url.searchParams.set('roomName', nombre);
    const respuesta = await this.#getJson(url, encabezados, 'resolución');
    if (!respuesta || respuesta.success !== true || !respuesta.room || typeof respuesta.room !== 'object') {
      throw this.#errorApi(400, respuesta, 'resolución');
    }

    const { _id: id, name, t: tipo } = respuesta.room;
    if (typeof id !== 'string' || id.length === 0 || typeof name !== 'string' || name.length === 0 || !['c', 'p'].includes(tipo)) {
      throw new Error('Respuesta de Rocket.Chat inválida al resolver la sala');
    }
    return { id, nombre: name, tipo };
  }

  async #leerHistorial(base, sala, encabezados, desde) {
    const endpoint = sala.tipo === 'c' ? 'channels.history' : 'groups.history';
    const mensajes = [];
    let offset = 0;
    const limiteSuperior = new Date().toISOString();

    while (true) {
      const url = new URL(`${base}/${endpoint}`);
      url.searchParams.set('roomId', sala.id);
      url.searchParams.set('count', String(CANTIDAD_POR_PAGINA));
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('latest', limiteSuperior);
      if (desde) {
        const limiteTemporal = desde instanceof Date ? desde.toISOString() : new Date(desde).toISOString();
        url.searchParams.set('oldest', limiteTemporal);
        url.searchParams.set('inclusive', 'true');
      }
      const respuesta = await this.#getJson(url, encabezados, 'historial');
      if (respuesta?.success === false) throw this.#errorApi(400, respuesta, 'historial');
      if (!respuesta || respuesta.success !== true || !Array.isArray(respuesta.messages)) {
        throw new Error('Respuesta JSON inválida de Rocket.Chat: se esperaba messages');
      }
      if (respuesta.offset !== undefined && respuesta.offset !== offset) {
        throw new Error('Respuesta de Rocket.Chat con offset inesperado');
      }

      const total = respuesta.total;
      if (total !== undefined && (!Number.isSafeInteger(total) || total < 0)) {
        throw new Error('Respuesta de Rocket.Chat con total inválido');
      }
      if (total !== undefined && offset + respuesta.messages.length > total) {
        throw new Error('Respuesta de Rocket.Chat con más mensajes que el total anunciado');
      }

      for (const mensaje of respuesta.messages) {
        if (
          !mensaje || typeof mensaje !== 'object'
          || typeof mensaje.rid !== 'string' || mensaje.rid.length === 0
          || typeof mensaje._id !== 'string' || mensaje._id.length === 0
          || typeof mensaje.msg !== 'string'
          || typeof mensaje.ts !== 'string' || Number.isNaN(Date.parse(mensaje.ts))
        ) {
          throw new Error('Respuesta JSON inválida de Rocket.Chat: mensaje incompleto');
        }
        if (!this.#identidadValida({ rid: mensaje.rid, id: mensaje._id })) {
          throw new Error('Respuesta JSON inválida de Rocket.Chat: mensaje sin identidad válida');
        }
        mensajes.push(mensaje);
      }

      if (total !== undefined) {
        if (offset + respuesta.messages.length >= total) break;
        if (respuesta.messages.length === 0) {
          throw new Error('Respuesta incompleta de Rocket.Chat antes del total anunciado');
        }
      } else if (respuesta.messages.length < CANTIDAD_POR_PAGINA) {
        break;
      }

      offset += respuesta.messages.length;
    }

    return mensajes;
  }

  async #getJson(url, encabezados, operacion) {
    let respuesta;
    try {
      respuesta = await fetch(url, { headers: encabezados, redirect: 'error' });
    } catch {
      throw new Error('No se pudo conectar con Rocket.Chat');
    }

    if (!respuesta.ok) {
      let cuerpo;
      if (respuesta.status === 400) {
        try {
          cuerpo = await respuesta.json();
        } catch {
          if (operacion === 'resolución') throw new Error('No se pudo resolver la sala de Rocket.Chat');
        }
      }
      throw this.#errorApi(respuesta.status, cuerpo, operacion);
    }

    try {
      return await respuesta.json();
    } catch {
      throw new Error('Rocket.Chat devolvió JSON inválido');
    }
  }

  #errorApi(status, cuerpo, operacion) {
    if (status === 401) return new Error('Autenticación de Rocket.Chat inválida o expirada');
    if (status === 403) return new Error('Permisos insuficientes en Rocket.Chat');

    const tipo = String(cuerpo?.errorType ?? '').trim().toLowerCase();
    if (tipo === 'error-room-not-found') return new Error('La sala configurada no existe en Rocket.Chat');
    if (tipo === 'not allowed' || tipo === 'not-allowed' || tipo === 'error-forbidden') {
      return new Error('El usuario autenticado no tiene acceso a la sala de Rocket.Chat');
    }
    if (operacion === 'resolución' && status === 400) {
      return new Error('No se pudo resolver la sala de Rocket.Chat');
    }
    return new Error(`Rocket.Chat respondió HTTP ${status}`);
  }
}
