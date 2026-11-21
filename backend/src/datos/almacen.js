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
