import { TipoTrabajo } from './constantes.js';

export class FiltroInvalidoError extends Error {}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Construye y valida un Filtro a partir de los parámetros de la URL (CU-02, RF-11). */
export function crearFiltro(query = {}) {
  const filtro = {
    desarrolladorId: query.desarrollador || null,
    proyectoId: query.proyecto || null,
    tipo: query.tipo || null,
    moduloCore: query.modulo || null,
    desde: query.desde || null,
    hasta: query.hasta || null,
  };

  if (filtro.tipo && !Object.hasOwn(TipoTrabajo, filtro.tipo)) {
    throw new FiltroInvalidoError(`Tipo de trabajo no válido: ${filtro.tipo}`);
  }
  for (const campo of ['desde', 'hasta']) {
    if (filtro[campo] && (!FECHA_ISO.test(filtro[campo]) || Number.isNaN(Date.parse(filtro[campo])))) {
      throw new FiltroInvalidoError(`La fecha "${campo}" debe tener el formato AAAA-MM-DD`);
    }
  }
  if (filtro.desde && filtro.hasta && filtro.desde > filtro.hasta) {
    throw new FiltroInvalidoError('La fecha "desde" no puede ser posterior a "hasta"');
  }
  return filtro;
}

/**
 * Un usuario con Rol de solo propios (Técnico) siempre ve únicamente su propia Carga,
 * aunque pida otro Desarrollador en el Filtro.
 */
export function aplicarRestriccionRol(filtro, usuario) {
  if (usuario.rol.soloPropios) {
    return { ...filtro, desarrolladorId: usuario.desarrolladorId };
  }
  return filtro;
}

/** Una Petición entra en el rango de fechas si su periodo planificado se cruza con él. */
function cruzaRango(peticion, desde, hasta) {
  if (desde && peticion.fechaFin && peticion.fechaFin < desde) return false;
  if (hasta && peticion.fechaInicio && peticion.fechaInicio > hasta) return false;
  return true;
}

export function filtrarPeticiones(peticiones, filtro) {
  return peticiones.filter(
    (p) =>
      (!filtro.desarrolladorId || p.desarrolladorId === filtro.desarrolladorId) &&
      (!filtro.proyectoId || p.proyectoId === filtro.proyectoId) &&
      (!filtro.tipo || p.tipo === filtro.tipo) &&
      (!filtro.moduloCore || p.modulosCore.includes(filtro.moduloCore)) &&
      cruzaRango(p, filtro.desde, filtro.hasta),
  );
}
