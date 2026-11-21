import { calcularAvance } from './avance.js';

/** Desarrollador del área de TI al que se asignan peticiones (glosario: Desarrollador). */
export class Desarrollador {
  constructor({ id, nombre, correo = null, usuarioGitlab = null, idRedmine = null, usuarioGlpi = null }) {
    this.id = id;
    this.nombre = nombre;
    this.correo = correo;
    this.usuarioGitlab = usuarioGitlab;
    this.idRedmine = idRedmine;
    this.usuarioGlpi = usuarioGlpi;
  }
}

/** Proyecto que agrupa peticiones (glosario: Proyecto). */
export class Proyecto {
  constructor({ codigo, nombre }) {
    this.codigo = codigo;
    this.nombre = nombre;
  }
}

/** Módulo del core financiero afectado por una petición (glosario: ModuloCore). */
export class ModuloCore {
  constructor({ id = null, nombre }) {
    this.id = id;
    this.nombre = nombre;
  }
}

/** Actividad técnica proveniente de GitLab vinculada a una petición (glosario: ActividadCodigo). */
export class ActividadCodigo {
  constructor({ id = null, peticionCodigo, desarrolladorId = null, tipo, rama, idOrigen = null, estado = null, fecha }) {
    this.id = id;
    this.peticionCodigo = peticionCodigo;
    this.desarrolladorId = desarrolladorId;
    this.tipo = tipo;
    this.rama = rama;
    this.idOrigen = idOrigen;
    this.estado = estado;
    this.fecha = fecha instanceof Date ? fecha.toISOString() : fecha;
  }
}

/** Unidad de trabajo registrada en RedMine (glosario: Peticion). */
export class Peticion {
  constructor({
    codigo,
    titulo,
    tipo,
    etapa,
    estado = 'abierta',
    desarrolladorId = null,
    proyectoCodigo = null,
    modulosCore = [],
    actividades = [],
    fechaInicio = null,
    fechaFin = null,
  }) {
    this.codigo = codigo;
    this.titulo = titulo;
    this.tipo = tipo;
    this.etapa = etapa;
    this.estado = estado;
    this.desarrolladorId = desarrolladorId;
    this.proyectoCodigo = proyectoCodigo;
    this.modulosCore = modulosCore;
    this.actividades = actividades;
    this.fechaInicio = fechaInicio;
    this.fechaFin = fechaFin;
  }

  calcularAvance() {
    return calcularAvance(this.etapa);
  }
}

/** Indicador de carga y avance de un desarrollador en un corte de tiempo (glosario: IndicadorCarga). */
export class IndicadorCarga {
  constructor({
    desarrolladorId,
    nombre,
    peticionesAbiertas,
    porTipo = {},
    avancePromedio = 0,
    superaUmbral = false,
    calculadoEn = new Date(),
  }) {
    this.desarrolladorId = desarrolladorId;
    this.nombre = nombre;
    this.peticionesAbiertas = peticionesAbiertas;
    this.porTipo = porTipo;
    this.avancePromedio = avancePromedio;
    this.superaUmbral = Boolean(superaUmbral);
    this.calculadoEn = calculadoEn instanceof Date ? calculadoEn.toISOString() : calculadoEn;
  }
}

/** Límite máximo de peticiones abiertas permitido antes de alertar (glosario: Umbral). */
export class Umbral {
  constructor({ maxPeticiones = 6, vigenteDesde = new Date(), configuradoPor = null } = {}) {
    this.maxPeticiones = Number(maxPeticiones);
    this.vigenteDesde = vigenteDesde instanceof Date ? vigenteDesde.toISOString() : vigenteDesde;
    this.configuradoPor = configuradoPor;
  }

  actualizar(nuevoMaxPeticiones, usuarioId = null, fecha = new Date()) {
    const valor = Number(nuevoMaxPeticiones);
    if (!Number.isInteger(valor) || valor < 1) {
      throw new Error('El umbral máximo debe ser un número entero mayor o igual a 1');
    }
    this.maxPeticiones = valor;
    this.vigenteDesde = fecha.toISOString();
    this.configuradoPor = usuarioId;
    return this;
  }
}

/** Aviso generado cuando la carga supera el umbral (glosario: Alerta). */
export class Alerta {
  constructor({
    id,
    desarrolladorId,
    mensaje,
    peticionesAbiertas,
    umbral,
    fecha = new Date(),
    enviadaRocketChat = false,
  }) {
    this.id = id;
    this.desarrolladorId = desarrolladorId;
    this.mensaje = mensaje;
    this.peticionesAbiertas = peticionesAbiertas;
    this.umbral = umbral;
    this.fecha = fecha instanceof Date ? fecha.toISOString() : fecha;
    this.enviadaRocketChat = Boolean(enviadaRocketChat);
  }

  async enviar(funcionEnvio) {
    if (typeof funcionEnvio === 'function') {
      const resultado = await funcionEnvio(this);
      this.enviadaRocketChat = Boolean(resultado?.enviadaRocketChat);
    }
    return this;
  }
}

/** Dato proveniente de una fuente que no pudo cruzarse por código (glosario: RegistroNoReconocido). */
export class RegistroNoReconocido {
  constructor({
    id = null,
    codigoOriginal,
    fuente,
    motivo = 'Código no encontrado en RedMine',
    revisado = false,
    peticionAsignada = null,
    detectadoEn = new Date(),
  }) {
    this.id = id ?? `reg-${fuente}-${codigoOriginal}-${Date.now()}`;
    this.codigoOriginal = codigoOriginal;
    this.fuente = fuente;
    this.motivo = motivo;
    this.revisado = Boolean(revisado);
    this.peticionAsignada = peticionAsignada;
    this.detectadoEn = detectadoEn instanceof Date ? detectadoEn.toISOString() : detectadoEn;
  }

  marcarRevisado(peticionCodigo = null) {
    this.revisado = true;
    if (peticionCodigo) {
      this.peticionAsignada = peticionCodigo;
    }
    return this;
  }
}