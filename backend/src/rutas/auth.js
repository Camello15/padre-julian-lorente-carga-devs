import { Router } from 'express';
import { config } from '../config.js';
import { requiereSesion } from '../auth/middleware.js';

const publico = ({ token, inicio, expira, usuario }) => ({
  token,
  inicio,
  expira,
  usuario: {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    desarrolladorId: usuario.desarrolladorId ?? null,
    rol: { clave: usuario.rol.clave, nombre: usuario.rol.nombre, permisos: usuario.rol.permisos, soloPropios: usuario.rol.soloPropios },
  },
});

export function rutasAuth(servicioSesiones) {
  const router = Router();

  // POST /api/auth/login  { rol: "PMO" | "TECNICO" | "ADMINISTRATIVO" }  — SSO simulado (CU-01).
  router.post('/login', (req, res) => {
    if (config.sso.modo !== 'mock') {
      return res.status(501).json({ error: 'El SSO real de la cooperativa aún no está integrado.' });
    }
    const sesion = servicioSesiones.iniciarSesionMock(req.body?.rol);
    if (!sesion) {
      return res.status(400).json({ error: 'Elige un rol de prueba válido: PMO, TECNICO o ADMINISTRATIVO.' });
    }
    return res.status(201).json(publico(sesion));
  });

  router.get('/sesion', requiereSesion(servicioSesiones), (req, res) => res.json(publico(req.sesion)));

  router.post('/logout', requiereSesion(servicioSesiones), (req, res) => {
    servicioSesiones.cerrarSesion(req.sesion.token);
    res.status(204).end();
  });

  return router;
}
