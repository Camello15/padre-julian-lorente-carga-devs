import { config } from '../config.js';
import { Etapa } from './constantes.js';

/**
 * Avance estimado por Etapa (RF-08).
 * RedMine no registra el avance real, solo la planificación; por eso el avance se estima según la Etapa.
 * PROPUESTA DEL EQUIPO, pendiente de validar con la cooperativa.
 * Se puede cambiar sin tocar el código con la variable de entorno AVANCE_POR_ETAPA (JSON).
 */
export const AVANCE_POR_ETAPA_PROPUESTO = Object.freeze({
  [Etapa.ANALISIS]: 10,
  [Etapa.DESARROLLO]: 40,
  [Etapa.CERTIFICACION]: 70,
  [Etapa.DESPLIEGUE]: 90,
  [Etapa.ESTABILIZACION]: 100,
});

export function cargarTablaAvance(json = config.avancePorEtapaJson) {
  if (!json) return AVANCE_POR_ETAPA_PROPUESTO;
  const tabla = JSON.parse(json);
  for (const etapa of Object.values(Etapa)) {
    const valor = tabla[etapa];
    if (!Number.isInteger(valor) || valor < 0 || valor > 100) {
      throw new Error(`AVANCE_POR_ETAPA: falta un entero entre 0 y 100 para ${etapa}`);
    }
  }
  return Object.freeze({ ...tabla });
}

export const AVANCE_POR_ETAPA = cargarTablaAvance();

/** Devuelve el Avance (0–100) de una Etapa. */
export function calcularAvance(etapa, tabla = AVANCE_POR_ETAPA) {
  if (!Object.hasOwn(tabla, etapa)) {
    throw new RangeError(`Etapa desconocida: ${etapa}`);
  }
  return tabla[etapa];
}

/** Promedio entero del Avance de un conjunto de peticiones; 0 si no hay ninguna. */
export function avancePromedio(peticiones) {
  if (peticiones.length === 0) return 0;
  const suma = peticiones.reduce((total, p) => total + p.avance, 0);
  return Math.round(suma / peticiones.length);
}
