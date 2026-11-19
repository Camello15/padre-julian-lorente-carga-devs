import { Router } from 'express';
import { calcularCarga } from '../datos/carga.js';
import { aplicarRestriccionRol, crearFiltro, filtrarPeticiones } from '../datos/filtro.js';
import { ORDEN_ETAPAS, NOMBRE_ETAPA, NOMBRE_TIPO, TipoTrabajo } from '../datos/constantes.js';

/** Construye el Filtro de la petición HTTP y le aplica la restricción del Rol. */
function filtroDe(req) {
  return aplicarRestriccionRol(crearFiltro(req.query), req.usuario);
}

const desarrolladoresVisibles = (almacen, filtro) =>
  almacen.desarrolladores.filter((d) => !filtro.desarrolladorId || d.id === filtro.desarrolladorId);

export function rutasDatos(almacen, umbral) {
  const router = Router();

  // GET /api/catalogos — opciones para el panel de Filtros.
  router.get('/catalogos', (req, res) => {
    const filtro = aplicarRestriccionRol(crearFiltro(), req.usuario);
    res.json({
      desarrolladores: desarrolladoresVisibles(almacen, filtro).map(({ id, nombre }) => ({ id, nombre })),
      proyectos: almacen.proyectos,
      modulosCore: [...new Set(almacen.peticiones.flatMap((p) => p.modulosCore))].sort((a, b) => a.localeCompare(b, 'es')),
      tipos: Object.values(TipoTrabajo).map((clave) => ({ clave, nombre: NOMBRE_TIPO[clave] })),
      etapas: ORDEN_ETAPAS.map((clave) => ({ clave, nombre: NOMBRE_ETAPA[clave] })),
      umbral,
    });
  });

  // GET /api/peticiones?desarrollador=&tipo=&proyecto=&modulo=&desde=&hasta=  (RF-11)
  router.get('/peticiones', (req, res) => {
    const filtro = filtroDe(req);
    const peticiones = filtrarPeticiones(almacen.peticiones, filtro);
    res.json({ filtro, total: peticiones.length, peticiones });
  });

  // GET /api/carga — IndicadorCarga por Desarrollador, con los mismos Filtros (RF-10).
  router.get('/carga', (req, res) => {
    const filtro = filtroDe(req);
    const peticiones = filtrarPeticiones(almacen.peticiones, filtro);
    const indicadores = calcularCarga(peticiones, desarrolladoresVisibles(almacen, filtro), umbral);
    const abiertas = peticiones.filter((p) => p.estado === 'abierta');
    res.json({
      filtro,
      umbral,
      resumen: {
        peticionesAbiertas: abiertas.length,
        desarrolladoresSobreUmbral: indicadores.filter((i) => i.superaUmbral).length,
        ultimaSincronizacion: almacen.estadoSincronizacion.fin,
        estadoSincronizacion: almacen.estadoSincronizacion.estado,
      },
      modulosConCambios: [...new Set(peticiones.filter((p) => p.actividades.length > 0).flatMap((p) => p.modulosCore))],
      indicadores,
    });
  });

  // GET /api/alertas — Alertas vigentes (RF-12). El Técnico solo ve las suyas.
  router.get('/alertas', (req, res) => {
    const filtro = aplicarRestriccionRol(crearFiltro(), req.usuario);
    const alertas = almacen.alertas.filter((a) => !filtro.desarrolladorId || a.desarrolladorId === filtro.desarrolladorId);
    res.json({ total: alertas.length, alertas });
  });

  return router;
}
