/** Colores y nombres de cada Tipo de trabajo; se usan igual en el gráfico, la tabla y los filtros. */
export const TIPOS = [
  { clave: 'POA', nombre: 'POA', color: '#2F6FB2' },
  { clave: 'REC', nombre: 'REC', color: '#C98A12' },
  { clave: 'INICIATIVA', nombre: 'Iniciativa', color: '#4E8A3A' },
  { clave: 'INCIDENTE', nombre: 'Incidente', color: '#C0453A' },
];

export const TIPO_POR_CLAVE = Object.fromEntries(TIPOS.map((t) => [t.clave, t]));

export const ETAPAS = [
  { clave: 'ANALISIS', nombre: 'Análisis' },
  { clave: 'DESARROLLO', nombre: 'Desarrollo' },
  { clave: 'CERTIFICACION', nombre: 'Certificación' },
  { clave: 'DESPLIEGUE', nombre: 'Despliegue' },
  { clave: 'ESTABILIZACION', nombre: 'Estabilización' },
];

export const ROLES_PRUEBA = [
  { clave: 'PMO', nombre: 'PMO', descripcion: 'Ve la carga de todo el equipo y puede exportar reportes.' },
  { clave: 'TECNICO', nombre: 'Técnico', descripcion: 'Ve solo su propia carga. Usuario de prueba: Andrea Torres.' },
  { clave: 'ADMINISTRATIVO', nombre: 'Administrativo', descripcion: 'Ve la carga de todo el equipo, sin exportar.' },
  {
    clave: 'ADMINISTRADOR_TI',
    nombre: 'Administrador TI',
    descripcion: 'Ve la carga del equipo, configura el umbral y revisa los registros no reconocidos.',
  },
];
