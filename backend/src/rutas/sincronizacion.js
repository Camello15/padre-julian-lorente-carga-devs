import { Router } from 'express';

export function rutasSincronizacion(almacen) {
  const router = Router();
  // GET /api/sincronizacion/estado — última Sincronización, estado por Fuente y fallos (RNF-01, CU-06).
  router.get('/estado', (_req, res) => res.json(almacen.estadoSincronizacion));
  return router;
}
