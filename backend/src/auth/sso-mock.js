import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config } from '../config.js';
import { obtenerRol } from './roles.js';

/**
 * SSO SIMULADO (CU-01). No guarda contraseñas: el usuario elige un Rol de prueba.
 * TODO (Camilo + Bryan): integrar el SSO real de la cooperativa cuando se confirme el protocolo
 * (OIDC/SAML/CAS). El flujo real redirige al login de la cooperativa y el backend valida el token
 * recibido; aquí solo cambia cómo se obtiene el Usuario.
 */
const usuariosPrueba = JSON.parse(
  readFileSync(new URL('../../mocks/usuarios-sso.json', import.meta.url), 'utf8'),
);

export class ServicioSesiones {
  constructor({ duracionMin = config.sso.duracionSesionMin, reloj = () => new Date() } = {}) {
    this.duracionMs = duracionMin * 60 * 1000;
    this.reloj = reloj;
    this.sesiones = new Map();
  }

  iniciarSesionMock(claveRol) {
    const rol = obtenerRol(claveRol);
    if (!rol) return null;
    const datos = usuariosPrueba.find((u) => u.rol === rol.clave);
    const inicio = this.reloj();
    const sesion = {
      token: randomBytes(32).toString('hex'),
      inicio: inicio.toISOString(),
      expira: new Date(inicio.getTime() + this.duracionMs).toISOString(),
      usuario: { ...datos, rol },
    };
    this.sesiones.set(sesion.token, sesion);
    return sesion;
  }

  obtenerSesion(token) {
    const sesion = token ? this.sesiones.get(token) : null;
    if (!sesion) return null;
    if (new Date(sesion.expira) <= this.reloj()) {
      this.sesiones.delete(token);
      return null;
    }
    return sesion;
  }

  cerrarSesion(token) {
    this.sesiones.delete(token);
  }
}
