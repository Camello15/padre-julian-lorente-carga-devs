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

  /** Guarda de forma atómica el snapshot y cursor exitosos de una fuente. */
  guardarSnapshotFuente(nombreFuente, datos, fecha, { incremental = false, cursor = fecha } = {}) {
    const snapshot = this.combinarSnapshotFuente(nombreFuente, datos, { incremental });
    this.confirmarSnapshotFuente(nombreFuente, snapshot, fecha, cursor);
    return snapshot;
  }

  combinarSnapshotFuente(nombreFuente, datos, { incremental = false } = {}) {
    const anterior = this.ultimosDatosFuente(nombreFuente);
    let snapshot = datos;
    if (incremental || nombreFuente === 'redmine') {
      // La ausencia en un delta no implica eliminación; no se aplica estrategia de borrado.
      const base = incremental && anterior ? anterior.datos : [];
      const porId = new Map(base.map((registro, indice) => [
        registro?.id === undefined || registro?.id === null ? `sin-id:${indice}` : String(registro.id),
        registro,
      ]));
      for (const registro of datos) {
        if (registro?.id === undefined || registro?.id === null) {
          throw new Error(`Registro incremental de ${nombreFuente} sin id`);
        }
        porId.set(String(registro.id), registro);
      }
      snapshot = [...porId.values()];
    }
    return snapshot;
  }

  confirmarSnapshotFuente(nombreFuente, datos, fecha, cursor = fecha) {
    const fechaIso = fecha.toISOString();
    const cursorIso = cursor.toISOString();
    this.ultimosDatosPorFuente.set(nombreFuente, { datos, fecha: fechaIso, cursor: cursorIso });
  }

  rehidratarSnapshotFuente(nombreFuente, datos, fecha, cursor) {
    this.ultimosDatosPorFuente.set(nombreFuente, { datos, fecha, cursor });
  }

  cursorFuente(nombreFuente) {
    return this.ultimosDatosFuente(nombreFuente)?.cursor ?? null;
  }

  ultimosDatosFuente(nombreFuente) {
    return this.ultimosDatosPorFuente.get(nombreFuente) ?? null;
  }

  guardarResultado(resultado) {
    const registros = (resultado.registrosNoReconocidos ?? this.registrosNoReconocidos).map((reg, idx) => ({
      id: reg.id ?? `reg-${reg.fuente ?? 'fuente'}-${reg.codigoOriginal ?? idx}-${idx + 1}`,
      revisado: Boolean(reg.revisado),
      peticionAsignada: reg.peticionAsignada ?? null,
      ...reg,
    }));

    Object.assign(this, {
      ...resultado,
      registrosNoReconocidos: registros,
    });
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
    if (typeof this.estadoSincronizacion.registrosNoReconocidos === 'number') {
      this.estadoSincronizacion.registrosNoReconocidos = this.registrosNoReconocidos.filter((r) => !r.revisado).length;
    }
    return registro;
  }
}
