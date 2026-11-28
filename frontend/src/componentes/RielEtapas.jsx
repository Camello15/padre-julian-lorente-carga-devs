import { ETAPAS } from '../utilidades/catalogo.js';

/** Muestra en qué Etapa va una Petición y su Avance estimado (RF-08). */
export default function RielEtapas({ etapa, avance }) {
  const posicion = ETAPAS.findIndex((e) => e.clave === etapa);
  const nombre = ETAPAS[posicion]?.nombre ?? 'Sin etapa';

  return (
    <div className="riel" role="img" aria-label={`Etapa ${nombre}, avance estimado ${avance} %`}>
      <div className="riel__tramos" aria-hidden="true">
        {ETAPAS.map((e, i) => (
          <span
            key={e.clave}
            title={e.nombre}
            className={`riel__tramo${i < posicion ? ' riel__tramo--hecho' : ''}${i === posicion ? ' riel__tramo--actual' : ''}`}
          />
        ))}
      </div>
      <span className="riel__texto" aria-hidden="true">
        {nombre} <span className="riel__porcentaje">{avance} %</span>
      </span>
    </div>
  );
}
