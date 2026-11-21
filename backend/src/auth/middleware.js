import { tienePermiso } from './roles.js';

/** Exige una Sesión válida (cabecera Authorization: Bearer <token>). */
export function requiereSesion(servicioSesiones) {
  return (req, res, next) => {
    const [esquema, token] = (req.get('authorization') ?? '').split(' ');
    const sesion = esquema === 'Bearer' ? servicioSesiones.obtenerSesion(token) : null;
    if (!sesion) {
      return res.status(401).json({ error: 'Tu sesión no es válida o expiró. Vuelve a ingresar.' });
    }
    req.sesion = sesion;
    req.usuario = sesion.usuario;
    return next();
  };
}

export function requierePermiso(permiso) {
  return (req, res, next) => {
    if (!tienePermiso(req.usuario.rol, permiso)) {
      return res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción.' });
    }
    return next();
  };
}
