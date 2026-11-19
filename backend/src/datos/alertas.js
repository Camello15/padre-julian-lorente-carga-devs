import { config } from '../config.js';

/** Genera una Alerta por cada Desarrollador cuya Carga supera el Umbral (CU-09, RF-12). */
export function generarAlertas(indicadores, umbral, fecha = new Date()) {
  return indicadores
    .filter((indicador) => indicador.superaUmbral)
    .map((indicador) => ({
      id: `alerta-${indicador.desarrolladorId}-${fecha.getTime()}`,
      desarrolladorId: indicador.desarrolladorId,
      mensaje: `${indicador.nombre} tiene ${indicador.peticionesAbiertas} peticiones abiertas; el umbral es ${umbral.maxPeticiones}.`,
      peticionesAbiertas: indicador.peticionesAbiertas,
      umbral: umbral.maxPeticiones,
      fecha: fecha.toISOString(),
      enviadaRocketChat: false,
    }));
}

/**
 * Envía la Alerta al canal de Rocket Chat configurado.
 * TODO (Cristina, CU-09): POST {ROCKETCHAT_URL}/api/v1/chat.postMessage
 *   cabeceras X-Auth-Token y X-User-Id; cuerpo { channel: canalAlertas, text: alerta.mensaje }.
 *   Evitar reenviar la misma alerta en cada sincronización (guardar la última enviada por Desarrollador).
 */
export async function enviarAlertaRocketChat(alerta, rocketchat = config.fuentes.rocketchat) {
  if (config.usarMocks || !rocketchat.url) {
    return { ...alerta, enviadaRocketChat: false };
  }
  throw new Error('Envío a Rocket Chat pendiente de implementar');
}
