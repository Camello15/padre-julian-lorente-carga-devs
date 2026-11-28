import { formatearFechaHora } from '../utilidades/formato.js';

/** Alertas en pantalla cuando una Carga supera el Umbral (RF-12). */
export default function PanelAlertas({ alertas, umbral }) {
  if (alertas.length === 0) {
    return (
      <p className="vacio vacio--ok">
        Nadie supera el umbral de {umbral.maxPeticiones} peticiones abiertas.
      </p>
    );
  }
  return (
    <ul className="alertas">
      {alertas.map((alerta) => (
        <li key={alerta.id} className="alerta">
          <span className="alerta__cifra" aria-hidden="true">{alerta.peticionesAbiertas}</span>
          <div>
            <p>{alerta.mensaje}</p>
            <time className="texto-suave" dateTime={alerta.fecha}>{formatearFechaHora(alerta.fecha)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}
