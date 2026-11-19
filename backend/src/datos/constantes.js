/** Tipo de trabajo de una Petición (RF-07). */
export const TipoTrabajo = Object.freeze({
  POA: 'POA',
  REC: 'REC',
  INICIATIVA: 'INICIATIVA',
  INCIDENTE: 'INCIDENTE',
});

/** Etapas de RedMine, en orden (RF-08). */
export const Etapa = Object.freeze({
  ANALISIS: 'ANALISIS',
  DESARROLLO: 'DESARROLLO',
  CERTIFICACION: 'CERTIFICACION',
  DESPLIEGUE: 'DESPLIEGUE',
  ESTABILIZACION: 'ESTABILIZACION',
});

export const ORDEN_ETAPAS = Object.freeze(Object.values(Etapa));

export const NOMBRE_ETAPA = Object.freeze({
  ANALISIS: 'Análisis',
  DESARROLLO: 'Desarrollo',
  CERTIFICACION: 'Certificación',
  DESPLIEGUE: 'Despliegue',
  ESTABILIZACION: 'Estabilización',
});

export const NOMBRE_TIPO = Object.freeze({
  POA: 'POA',
  REC: 'REC',
  INICIATIVA: 'Iniciativa',
  INCIDENTE: 'Incidente',
});

/** Quita tildes y pasa a mayúsculas: "Certificación" -> "CERTIFICACION". */
export function normalizarClave(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}
