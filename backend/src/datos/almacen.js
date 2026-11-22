/**
 * Almacén en memoria con el resultado de la última Sincronización.
 * Las rutas solo usan esta interfaz, así que el cambio a PostgreSQL no las afecta.
 */
export class AlmacenMemoria {
  constructor() {
    this.ultimosDatosPorFuente = new Map();
    this.desarrolladores = [];
    this.proyectos = [];
    this.modulosConCambios = [];
    this.peticiones = [];
    this.indicadores = [];
    this.alertas = [];
    this.registrosNoReconocidos = [];
    this.notificaciones = [];
    this.estadoSincronizacion = { estado: 'pendiente', inicio: null, fin: null, fuentes: [], fallos: [] };
  }

  guardarDatosFuente(nombreFuente, datos, fecha) {
    this.ultimosDatosPorFuente.set(nombreFuente, { datos, fecha: fecha.toISOString() });
  }

  ultimosDatosFuente(nombreFuente) {
    return this.ultimosDatosPorFuente.get(nombreFuente) ?? null;
  }

  guardarResultado(resultado) {
    const { registrosNoReconocidos, ...resto } = resultado;
    Object.assign(this, resto);
    if (registrosNoReconocidos) {
      this.registrosNoReconocidos = this.conservarRevisiones(registrosNoReconocidos);
    }
    this.actualizarPendientes();
  }

  /**
   * Cada Sincronización vuelve a detectar los mismos registros no reconocidos (CU-11).
   * El id es estable (fuente + código original) para que la revisión hecha por el
   * Administrador TI no se pierda en la siguiente Sincronización.
   */
  conservarRevisiones(nuevos) {
    const anteriores = new Map(this.registrosNoReconocidos.map((r) => [r.id, r]));
    const repeticiones = new Map();
    return nuevos.map((reg) => {
      const clave = `${reg.fuente}:${reg.codigoOriginal}`;
      const vez = (repeticiones.get(clave) ?? 0) + 1;
      repeticiones.set(clave, vez);
      const id = vez === 1 ? clave : `${clave}#${vez}`;
      const previo = anteriores.get(id);
      return {
        ...reg,
        id,
        revisado: previo?.revisado ?? Boolean(reg.revisado),
        peticionAsignada: previo?.peticionAsignada ?? reg.peticionAsignada ?? null,
      };
    });
  }

  actualizarPendientes() {
    if (typeof this.estadoSincronizacion.registrosNoReconocidos === 'number') {
      this.estadoSincronizacion.registrosNoReconocidos = this.registrosNoReconocidos.filter((r) => !r.revisado).length;
    }
  }

  listarRegistrosNoReconocidos({ incluirRevisados = false } = {}) {
    if (incluirRevisados) return this.registrosNoReconocidos;
    return this.registrosNoReconocidos.filter((r) => !r.revisado);
  }

  marcarRegistroNoReconocido(id, peticionCodigo = null) {
    const registro = this.registrosNoReconocidos.find((r) => String(r.id) === String(id));
    if (!registro) return null;
    registro.revisado = true;
    if (peticionCodigo) {
      registro.peticionAsignada = peticionCodigo;
    }
    this.actualizarPendientes();
    return registro;
  }
}
