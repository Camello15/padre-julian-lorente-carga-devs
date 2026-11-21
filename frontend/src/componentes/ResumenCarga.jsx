import { formatearFechaHora, plural } from '../utilidades/formato.js';

const ESTADO_SYNC = {
  ok: 'Todas las fuentes respondieron.',
  parcial: 'Alguna fuente no respondió; se muestran sus últimos datos.',
  fallida: 'Ninguna fuente respondió; se muestran los últimos datos.',
  pendiente: 'Esperando la primera sincronización.',
};

/** Tarjetas resumen del Dashboard (CU-03). */
export default function ResumenCarga({ resumen, umbral }) {
  const sobre = resumen.desarrolladoresSobreUmbral;
  return (
    <dl className="resumen">
      <div className="resumen__dato">
        <dt>Peticiones abiertas</dt>
        <dd className="resumen__cifra">{resumen.peticionesAbiertas}</dd>
        <dd className="resumen__detalle">Con los filtros actuales</dd>
      </div>
      <div className={`resumen__dato${sobre > 0 ? ' resumen__dato--alerta' : ''}`}>
        <dt>Sobre el umbral</dt>
        <dd className="resumen__cifra">{sobre}</dd>
        <dd className="resumen__detalle">
          {sobre === 0 ? 'Nadie' : plural(sobre, 'desarrollador', 'desarrolladores')} con más de {umbral.maxPeticiones} peticiones
        </dd>
      </div>
      <div className="resumen__dato">
        <dt>Última sincronización</dt>
        <dd className="resumen__cifra resumen__cifra--fecha">{formatearFechaHora(resumen.ultimaSincronizacion)}</dd>
        <dd className={`resumen__detalle${resumen.estadoSincronizacion !== 'ok' ? ' resumen__detalle--aviso' : ''}`}>
          {ESTADO_SYNC[resumen.estadoSincronizacion] ?? ''} Se actualiza cada 15 minutos.
        </dd>
      </div>
    </dl>
  );
}
