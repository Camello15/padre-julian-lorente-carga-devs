/** Roles del sistema (glosario: PMO, Técnico, Administrativo, Administrador TI). */
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
    permisos: Object.freeze(['ver:todos']),
    soloPropios: false,
  }),
  // Único rol que configura el Umbral (CU-10) y revisa registros no reconocidos (CU-11).
  ADMINISTRADOR_TI: Object.freeze({
    clave: 'ADMINISTRADOR_TI',
    nombre: 'Administrador TI',
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
