/** Roles del sistema (diccionario: PMO, Técnico, Administrativo). */
export const Rol = Object.freeze({
  PMO: Object.freeze({
    clave: 'PMO',
    nombre: 'PMO',
    permisos: Object.freeze(['ver:todos', 'exportar']),
    soloPropios: false,
  }),
  TECNICO: Object.freeze({
    clave: 'TECNICO',
    nombre: 'Técnico',
    permisos: Object.freeze(['ver:propios']),
    soloPropios: true,
  }),
  ADMINISTRATIVO: Object.freeze({
    clave: 'ADMINISTRATIVO',
    nombre: 'Administrativo',
    permisos: Object.freeze(['ver:todos', 'configurar']),
    soloPropios: false,
  }),
});

export function obtenerRol(clave) {
  return Object.hasOwn(Rol, clave) ? Rol[clave] : null;
}

export function tienePermiso(rol, permiso) {
  return rol.permisos.includes(permiso);
}