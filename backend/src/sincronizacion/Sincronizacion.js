import { generarAlertas, enviarAlertaRocketChat } from '../datos/alertas.js';
import { calcularCarga } from '../datos/carga.js';
import { unificar } from './normalizador.js';

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const SOLAPAMIENTO_CURSOR_MS = 5 * 60 * 1000;
const FUENTES_INCREMENTALES = new Set(['redmine', 'gitlab']);

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
  constructor({ conectores, almacen, desarrolladores, umbral, reintentos = 3, esperaReintentoMs = 2000, reloj = () => new Date() }) {
    this.conectores = conectores;
    this.almacen = almacen;
    this.desarrolladores = desarrolladores;
    this.umbral = umbral;
    this.reintentos = reintentos;
    this.esperaReintentoMs = esperaReintentoMs;
    this.reloj = reloj;
    this.enEjecucion = false;
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

    try {
      const lecturas = await Promise.all(
        this.conectores.map(async (conector) => {
          const nombre = conector.fuente.nombre;
          const cursorAnterior = this.almacen.cursorFuente?.(nombre) ?? null;
          const usaCursor = FUENTES_INCREMENTALES.has(nombre);
          const desde = usaCursor ? cursorConSolapamiento(cursorAnterior) : null;
          try {
            const { datos, intentos } = await this.leerConReintentos(conector, desde, this.desarrolladores);
            const fechaExitosa = this.reloj();
            const incremental = usaCursor && cursorAnterior !== null;
            const snapshot = usaCursor
              ? this.almacen.combinarSnapshotFuente(nombre, datos, { incremental })
              : this.almacen.guardarSnapshotFuente(nombre, datos, fechaExitosa);
            return {
              nombre,
              datos: snapshot,
              estado: 'ok',
              intentos,
              registros: snapshot.length,
              ultimaLecturaExitosa: fechaExitosa.toISOString(),
              ...(usaCursor ? { fechaExitosa, cursorCandidato } : {}),
            };
          } catch (error) {
            const respaldo = this.almacen.ultimosDatosFuente(nombre);
            const fallo = { fuente: nombre, fecha: this.reloj().toISOString(), intentos: error.intentos, mensaje: error.message };
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
      const alertas = await Promise.all(generarAlertas(indicadores, this.umbral, this.reloj()).map((a) => enviarAlertaRocketChat(a)));
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
      for (const lectura of lecturas.filter((item) => FUENTES_INCREMENTALES.has(item.nombre) && item.estado === 'ok')) {
        this.almacen.confirmarSnapshotFuente(
          lectura.nombre,
          lectura.datos,
          lectura.fechaExitosa,
          lectura.cursorCandidato,
        );
      }
      return estadoSincronizacion;
    } finally {
      this.enEjecucion = false;
    }
  }
}
