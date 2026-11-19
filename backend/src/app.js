import cors from 'cors';
import express from 'express';
import { requiereSesion } from './auth/middleware.js';
import { FiltroInvalidoError } from './datos/filtro.js';
import { rutasAuth } from './rutas/auth.js';
import { rutasDatos } from './rutas/datos.js';
import { rutasSincronizacion } from './rutas/sincronizacion.js';

export function crearApp({ almacen, servicioSesiones, umbral, origenFrontend }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: origenFrontend }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/salud', (_req, res) => res.json({ estado: 'ok' }));
  app.use('/api/auth', rutasAuth(servicioSesiones));

  // Todo lo demás exige una Sesión válida (RNF-02).
  const sesion = requiereSesion(servicioSesiones);
  app.use('/api/sincronizacion', sesion, rutasSincronizacion(almacen));
  app.use('/api', sesion, rutasDatos(almacen, umbral));

  app.use((_req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));

  app.use((error, _req, res, _next) => {
    if (error instanceof FiltroInvalidoError) {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
  });

  return app;
}
