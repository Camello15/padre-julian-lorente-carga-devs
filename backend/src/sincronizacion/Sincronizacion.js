import { generarAlertas, enviarAlertaRocketChat } from '../datos/alertas.js';
import { calcularCarga } from '../datos/carga.js';
import { unificar } from './normalizador.js';

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const SOLAPAMIENTO_CURSOR_MS = 5 * 60 * 1000;
const FUENTES_INCREMENTALES = new Set(['redmine', 'gitlab', 'glpi', 'rocketchat']);

const fechaIso = (fecha) => (fecha instanceof Date ? fecha : new Date(fecha)).toISOString();

const cursorConSolapamiento = (cursor) => {
  if (!cursor) return null;
  const fecha = new Date(cursor);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Date(fecha.getTime() - SOLAPAMIENTO_CURSOR_MS);
};

/**
 * Sincronización de Fuentes (CU-05).
 * Lee todas las Fuentes en paralelo con reintentos; si una Fuente falla tras los reintentos,
 * registra el fallo (CU-06) y usa sus últimos datos buenos (RNF-01).
 */
export class Sincronizacion {
  constructor({ conectores, almacen, desarrolladores, umbral, reintentos = 3, esperaReintentoMs = 2000, reloj = () => new Date(), persistencia = null, modoMocks = false }) {
    this.conectores = conectores;
    this.almacen = almacen;
    this.desarrolladores = desarrolladores;
    this.umbral = umbral;
    this.reintentos = reintentos;
    this.esperaReintentoMs = esperaReintentoMs;
    this.reloj = reloj;
    this.persistencia = persistencia;
    this.modoMocks = modoMocks;
    this.enEjecucion = false;
  }

  #combinarRocketChat(conector, anterior, delta, incremental) {
    const datosAnteriores = anterior?.datos ?? [];
    const identidadesAnteriores = conector.exportarMetadatos(datosAnteriores);
    this.#validarIdentidadesRocketChat(identidadesAnteriores, datosAnteriores, 'snapshot anterior');

    const identidadesDelta = conector.exportarMetadatos(delta);
    this.#validarIdentidadesRocketChat(identidadesDelta, delta, 'delta');
    if (!incremental) return delta;
    if (delta.length === 0) return datosAnteriores;

    const porId = new Map();
    datosAnteriores.forEach((mensaje, indice) => porId.set(JSON.stringify([
      identidadesAnteriores[indice].rid,
      identidadesAnteriores[indice].id,
    ]), mensaje));
    delta.forEach((mensaje, indice) => porId.set(JSON.stringify([
      identidadesDelta[indice].rid,
      identidadesDelta[indice].id,
    ]), mensaje));
    return [...porId.values()];
  }

  #validarIdentidadesRocketChat(identidades, mensajes, descripcion) {
    if (!Array.isArray(identidades) || identidades.length !== mensajes.length || identidades.some((identidad) => (
      !identidad
      || typeof identidad.rid !== 'string' || identidad.rid.trim() === ''
      || typeof identidad.id !== 'string' || identidad.id.trim() === ''
    ))) {
      throw new Error(`Rocket.Chat devolvió identidades inválidas en ${descripcion}`);
    }
  }

  async leerConReintentos(conector, desde, desarrolladores) {
    let ultimoError;
    for (let intento = 1; intento <= this.reintentos; intento += 1) {
      try {
        const datos = conector.fuente.nombre === 'gitlab'
          ? await conector.leerDatos(desde, desarrolladores)
          : await conector.leerDatos(desde);
        return { datos, intentos: intento };
      } catch (error) {
        ultimoError = error;
        if (intento < this.reintentos) await esperar(this.esperaReintentoMs);
      }
    }
    const fallo = new Error(ultimoError?.message ?? 'Error desconocido');
    fallo.intentos = this.reintentos;
    throw fallo;
  }

  async ejecutar() {
    if (this.enEjecucion) return null; // Evita dos sincronizaciones a la vez.
    this.enEjecucion = true;
    const inicio = this.reloj();
    const cursorCandidato = new Date(inicio);
    const anterior = this.almacen.estadoSincronizacion;
    let sincronizacionId;
    let finalizacionIniciada = false;

    try {
      if (this.persistencia) sincronizacionId = await this.persistencia.crearSincronizacion(inicio);
      const lecturas = await Promise.all(
        this.conectores.map(async (conector) => {
          const nombre = conector.fuente.nombre;
          const cursorAnterior = this.almacen.cursorFuente?.(nombre) ?? null;
          const lecturaMock = this.modoMocks || (nombre === 'rocketchat' && conector.modoMock === true);
          const usaCursor = !lecturaMock && FUENTES_INCREMENTALES.has(nombre);
          const desde = usaCursor ? cursorConSolapamiento(cursorAnterior) : null;
          let intentosLectura = 0;
          try {
            const { datos, intentos } = await this.leerConReintentos(conector, desde, this.desarrolladores);
            intentosLectura = intentos;
            const fechaExitosa = this.reloj();
            const incremental = usaCursor && cursorAnterior !== null;
            const anteriorFuente = this.almacen.ultimosDatosFuente(nombre);
            const snapshot = nombre === 'rocketchat' && !lecturaMock
              ? this.#combinarRocketChat(conector, anteriorFuente, datos, incremental)
              : this.almacen.combinarSnapshotFuente(nombre, datos, { incremental });
            return {
              nombre,
              datos: snapshot,
              estado: 'ok',
              intentos,
              registros: snapshot.length,
              ultimaLecturaExitosa: fechaIso(fechaExitosa),
              fechaExitosa,
              lecturaMock,
              ...(usaCursor ? { cursorCandidato } : {}),
              ...(nombre === 'rocketchat' ? { conector } : {}),
            };
          } catch (error) {
            const respaldo = this.almacen.ultimosDatosFuente(nombre);
            const fallo = {
              fuente: nombre,
              fecha: this.reloj().toISOString(),
              intentos: error.intentos ?? intentosLectura ?? this.reintentos,
              mensaje: error.message,
            };
            return {
              nombre,
              datos: respaldo?.datos ?? [],
              estado: respaldo ? 'con-datos-anteriores' : 'sin-datos',
              intentos: error.intentos,
              registros: respaldo?.datos.length ?? 0,
              ultimaLecturaExitosa: respaldo?.fecha ?? null,
              fallo,
            };
          }
        }),
      );

      const datosPorFuente = Object.fromEntries(lecturas.map((l) => [l.nombre, l.datos]));
      const unificado = unificar(datosPorFuente, this.desarrolladores, inicio);
      const indicadores = calcularCarga(unificado.peticiones, this.desarrolladores, this.umbral, this.reloj());
      const alertasGeneradas = generarAlertas(indicadores, this.umbral, this.reloj());
      const fallos = lecturas.filter((l) => l.fallo).map((l) => l.fallo);

      const estadoSincronizacion = {
        estado: fallos.length === 0 ? 'ok' : fallos.length === lecturas.length ? 'fallida' : 'parcial',
        inicio: inicio.toISOString(),
        fin: this.reloj().toISOString(),
        ultimaExitosa: fallos.length === 0 ? inicio.toISOString() : anterior.ultimaExitosa ?? null,
        fuentes: lecturas.map(({ nombre, estado, intentos, registros, ultimaLecturaExitosa }) => ({ nombre, estado, intentos, registros, ultimaLecturaExitosa })),
        fallos: [...fallos, ...(anterior.fallos ?? [])].slice(0, 50),
        registrosNoReconocidos: unificado.registrosNoReconocidos.length,
      };

      const lecturasExitosas = lecturas.filter((lectura) => lectura.estado === 'ok');
      const snapshotsPersistidos = this.modoMocks ? [] : lecturasExitosas
        .filter((lectura) => FUENTES_INCREMENTALES.has(lectura.nombre) && !lectura.lecturaMock)
        .map((lectura) => ({
          nombre: lectura.nombre,
          datos: lectura.datos,
          fecha: fechaIso(lectura.fechaExitosa),
          cursor: this.modoMocks ? null : fechaIso(lectura.cursorCandidato),
          metadatos: lectura.nombre === 'rocketchat'
            ? lectura.conector.exportarMetadatos(lectura.datos)
            : [],
        }));

      if (this.persistencia) {
        finalizacionIniciada = true;
        await this.persistencia.finalizarSincronizacion({
          id: sincronizacionId,
          fin: estadoSincronizacion.fin,
          estado: estadoSincronizacion.estado,
          fallos,
          snapshots: snapshotsPersistidos,
        });
      }

      // No existe transacción distribuida entre PostgreSQL y Rocket.Chat; un cierre
      // del proceso entre ambas operaciones puede hacer que el ciclo siguiente reintente la alerta.
      const alertas = await Promise.all(alertasGeneradas.map(async (alerta) => {
        try {
          return await enviarAlertaRocketChat(alerta);
        } catch {
          return { ...alerta, enviadaRocketChat: false };
        }
      }));

      this.almacen.guardarResultado({
        desarrolladores: this.desarrolladores,
        proyectos: unificado.proyectos,
        modulosConCambios: unificado.modulosConCambios,
        peticiones: unificado.peticiones,
        notificaciones: unificado.notificaciones,
        registrosNoReconocidos: unificado.registrosNoReconocidos,
        indicadores,
        alertas,
        estadoSincronizacion,
      });
      for (const lectura of lecturasExitosas) {
        if (this.modoMocks || lectura.lecturaMock) {
          this.almacen.guardarDatosFuente(lectura.nombre, lectura.datos, lectura.fechaExitosa);
        } else if (FUENTES_INCREMENTALES.has(lectura.nombre)) {
          this.almacen.confirmarSnapshotFuente(lectura.nombre, lectura.datos, lectura.fechaExitosa, lectura.cursorCandidato);
        }
      }
      return estadoSincronizacion;
    } catch (error) {
      if (this.persistencia && sincronizacionId && !finalizacionIniciada) {
        try {
          await this.persistencia.finalizarSincronizacion({
            id: sincronizacionId,
            fin: this.reloj().toISOString(),
            estado: 'fallida',
            fallos: [],
            snapshots: [],
          });
        } catch {
          // Si PostgreSQL no está disponible, la fila iniciada puede quedar en-curso.
        }
      }
      throw error;
    } finally {
      this.enEjecucion = false;
    }
  }
}
