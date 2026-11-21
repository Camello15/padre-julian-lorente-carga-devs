import { avancePromedio } from './avance.js';
import { TipoTrabajo } from './constantes.js';
import { IndicadorCarga } from './modelos.js';

/**
 * Calcula el IndicadorCarga de cada Desarrollador (CU-08, RF-10).
 * Carga = peticiones abiertas asignadas; se compara con el Umbral.
 */
export function calcularCarga(peticiones, desarrolladores, umbral, calculadoEn = new Date()) {
  const maxPeticiones = umbral?.maxPeticiones ?? 6;

  return desarrolladores.map((desarrollador) => {
    const abiertas = peticiones.filter(
      (p) => p.desarrolladorId === desarrollador.id && p.estado === 'abierta',
    );
    const porTipo = Object.fromEntries(Object.values(TipoTrabajo).map((tipo) => [tipo, 0]));
    for (const peticion of abiertas) {
      if (Object.hasOwn(porTipo, peticion.tipo)) {
        porTipo[peticion.tipo] += 1;
      }
    }

    return new IndicadorCarga({
      desarrolladorId: desarrollador.id,
      nombre: desarrollador.nombre,
      peticionesAbiertas: abiertas.length,
      porTipo,
      avancePromedio: avancePromedio(abiertas),
      superaUmbral: abiertas.length > maxPeticiones,
      calculadoEn,
    });
  });
}