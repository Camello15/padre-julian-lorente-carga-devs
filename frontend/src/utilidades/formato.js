const zona = 'America/Guayaquil';

export function formatearFecha(iso) {
  if (!iso) return 'Sin fecha';
  // Las fechas AAAA-MM-DD se interpretan como día local para que no se corran un día.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric', timeZone: zona }).format(fecha);
}

export function formatearFechaHora(iso) {
  if (!iso) return 'Aún no se sincroniza';
  return new Intl.DateTimeFormat('es-EC', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: zona,
  }).format(new Date(iso));
}

/** Arma la consulta de la URL con los filtros que tienen valor. */
export function construirConsulta(filtros) {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor) parametros.set(clave, valor);
  }
  const texto = parametros.toString();
  return texto ? `?${texto}` : '';
}

export const FILTROS_VACIOS = Object.freeze({
  desarrollador: '', tipo: '', proyecto: '', modulo: '', desde: '', hasta: '',
});

export const plural = (n, singular, pluralTexto = `${singular}s`) => `${n} ${n === 1 ? singular : pluralTexto}`;
