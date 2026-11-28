import { createHash } from 'node:crypto';
import { calcularAvance } from '../datos/avance.js';
import { Etapa, TipoTrabajo, normalizarClave } from '../datos/constantes.js';

/** Códigos de Petición reconocidos: POA-2026-001, REC-2026-014, INC-2026-031, iniciativa.ti.001 */
const PATRON_CODIGO = /\b(POA-\d{4}-\d{3}|REC-\d{4}-\d{3}|INC-\d{4}-\d{3}|iniciativa\.ti\.\d{3})\b/i;

const TIPO_POR_TRACKER = {
  POA: TipoTrabajo.POA,
  REC: TipoTrabajo.REC,
  INICIATIVA: TipoTrabajo.INICIATIVA,
  INCIDENTE: TipoTrabajo.INCIDENTE,
};

export function extraerCodigo(texto) {
  const coincidencia = String(texto ?? '').match(PATRON_CODIGO);
  if (!coincidencia) return null;
  const codigo = coincidencia[1];
  return codigo.toLowerCase().startsWith('iniciativa') ? codigo.toLowerCase() : codigo.toUpperCase();
}

/** Id de la actividad en GitLab (SHA o id del MR/pipeline). Los mocks no lo traen: se deriva de forma estable. */
const idOrigenActividad = (evento) =>
  String(evento.id ?? evento.sha ?? createHash('sha1').update(`${evento.tipo}|${evento.rama}|${evento.fecha}|${evento.autor ?? ''}`).digest('hex'));

const campo = (issue, nombre) => issue.custom_fields?.find((c) => c.name === nombre)?.value;

/**
 * Normaliza y cruza por código los datos de las cuatro Fuentes (CU-07, RF-06, RF-07, RF-09).
 * Lo que no se puede cruzar se devuelve como Registro no reconocido (CU-11).
 */
export function unificar(datosPorFuente, desarrolladores, detectadoEn = new Date()) {
  const { redmine = [], gitlab = [], glpi = [], rocketchat = [] } = datosPorFuente;
  const fecha = detectadoEn.toISOString();
  const noReconocidos = [];
  const noReconocido = (fuente, codigoOriginal, motivo) =>
    noReconocidos.push({ codigoOriginal, fuente, motivo, revisado: false, detectadoEn: fecha });

  const porRedmine = new Map(desarrolladores.map((d) => [d.idRedmine, d.id]));
  const porGitlab = new Map(desarrolladores.map((d) => [d.usuarioGitlab, d.id]));
  const porGlpi = new Map(desarrolladores.map((d) => [d.usuarioGlpi, d.id]));

  // 1. RedMine es la fuente principal de Peticiones.
  const peticiones = new Map();
  const proyectos = new Map();
  for (const issue of redmine) {
    const codigo = extraerCodigo(campo(issue, 'Código'));
    const tipo = TIPO_POR_TRACKER[normalizarClave(issue.tracker?.name)];
    const etapa = normalizarClave(campo(issue, 'Etapa'));
    const etiqueta = campo(issue, 'Código') || `redmine#${issue.id}`;

    if (!codigo) { noReconocido('redmine', etiqueta, 'La petición no tiene un código válido'); continue; }
    if (!tipo) { noReconocido('redmine', codigo, `Tipo de trabajo desconocido: ${issue.tracker?.name}`); continue; }
    if (!Object.hasOwn(Etapa, etapa)) { noReconocido('redmine', codigo, 'La petición no tiene una etapa válida'); continue; }
    if (peticiones.has(codigo)) continue; // Duplicado: se conserva el primero.

    proyectos.set(issue.project.identifier, { codigo: issue.project.identifier, nombre: issue.project.name });
    peticiones.set(codigo, {
      codigo,
      titulo: issue.subject,
      tipo,
      etapa,
      avance: calcularAvance(etapa),
      estado: issue.status?.is_closed ? 'cerrada' : 'abierta',
      desarrolladorId: porRedmine.get(issue.assigned_to?.id) ?? null,
      proyectoId: issue.project.identifier,
      modulosCore: [].concat(campo(issue, 'Módulo del core') ?? []),
      fechaInicio: issue.start_date ?? null,
      fechaFin: issue.due_date ?? null,
      actualizadoEn: issue.updated_on ?? null,
      fuentes: ['redmine'],
      idsOrigen: { redmine: issue.id },
      actividades: [],
    });
  }

  // 2. GLPI: los incidentes se cruzan con la Petición de RedMine por su código (sin duplicar).
  for (const ticket of glpi) {
    const codigo = extraerCodigo(ticket.name);
    const peticion = codigo && peticiones.get(codigo);
    if (!peticion) {
      noReconocido('glpi', codigo ?? `glpi#${ticket.id}`, 'El incidente no corresponde a ninguna petición de RedMine');
      continue;
    }
    peticion.fuentes.push('glpi');
    peticion.idsOrigen.glpi = ticket.id;
    peticion.desarrolladorId ??= porGlpi.get(ticket.tecnico_asignado) ?? null;
  }

  // 3. GitLab: commits, merge requests y pipelines se asocian por el código en la rama.
  for (const evento of gitlab) {
    const codigo = extraerCodigo(evento.rama) ?? extraerCodigo(evento.titulo);
    const peticion = codigo && peticiones.get(codigo);
    if (!peticion) {
      noReconocido('gitlab', evento.rama, 'La rama no contiene el código de una petición conocida');
      continue;
    }
    if (!peticion.fuentes.includes('gitlab')) peticion.fuentes.push('gitlab');
    peticion.actividades.push({
      tipo: evento.tipo,
      rama: evento.rama,
      idOrigen: idOrigenActividad(evento),
      fecha: evento.fecha,
      estado: evento.estado ?? null,
      desarrolladorId: porGitlab.get(evento.autor) ?? null,
    });
  }

  // 4. Rocket Chat: notificaciones que mencionan una Petición.
  const notificaciones = rocketchat
    .map((m) => ({ canal: m.canal, texto: m.texto, fecha: m.fecha, codigo: extraerCodigo(m.texto) }))
    .filter((n) => n.codigo && peticiones.has(n.codigo));

  const lista = [...peticiones.values()];
  const modulosConCambios = [
    ...new Set(lista.filter((p) => p.actividades.length > 0).flatMap((p) => p.modulosCore)),
  ].sort((a, b) => a.localeCompare(b, 'es'));

  return {
    peticiones: lista,
    proyectos: [...proyectos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    modulosConCambios,
    notificaciones,
    registrosNoReconocidos: noReconocidos,
  };
}
