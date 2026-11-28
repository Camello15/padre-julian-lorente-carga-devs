import { Router } from 'express';
import { requierePermiso } from '../auth/middleware.js';
import { generarAlertas } from '../datos/alertas.js';
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

  // PUT /api/umbral — Configurar umbral máximo de peticiones abiertas (CU-10, RF-12).
  router.put('/umbral', requierePermiso('configurar'), async (req, res) => {
    const maxPeticiones = Number(req.body?.maxPeticiones);
    if (!Number.isInteger(maxPeticiones) || maxPeticiones < 1) {
      return res.status(400).json({ error: 'El umbral máximo debe ser un entero mayor o igual a 1.' });
    }

    umbral.maxPeticiones = maxPeticiones;
    umbral.vigenteDesde = new Date().toISOString();
    umbral.configuradoPor = req.usuario.id;

    if (typeof almacen.guardarUmbral === 'function') {
      await almacen.guardarUmbral(umbral);
    }

    const indicadores = calcularCarga(almacen.peticiones, almacen.desarrolladores, umbral);
    const alertas = generarAlertas(indicadores, umbral);
    await almacen.guardarResultado({ indicadores, alertas });

    return res.json({ umbral, indicadores, alertas });
  });

  // GET /api/registros-no-reconocidos — Bandeja de revisión para Administrador TI (CU-11, RF-06).
  router.get('/registros-no-reconocidos', requierePermiso('configurar'), (req, res) => {
    const incluirRevisados = req.query.todos === 'true';
    const registros = almacen.listarRegistrosNoReconocidos({ incluirRevisados });
    res.json({ total: registros.length, registros });
  });

  // PATCH /api/registros-no-reconocidos/:id — Marcar como revisado o asociar petición (CU-11).
  router.patch('/registros-no-reconocidos/:id', requierePermiso('configurar'), async (req, res) => {
    const peticionCodigo = typeof req.body?.peticionCodigo === 'string' ? req.body.peticionCodigo.trim() : null;
    if (peticionCodigo && !almacen.peticiones.some((p) => p.codigo === peticionCodigo)) {
      return res.status(400).json({ error: `La petición ${peticionCodigo} no existe.` });
    }
    const actualizado = await almacen.marcarRegistroNoReconocido(req.params.id, peticionCodigo || null);
    if (!actualizado) {
      return res.status(404).json({ error: 'Registro no reconocido no encontrado.' });
    }
    return res.json({ registro: actualizado });
  });

  return router;
}