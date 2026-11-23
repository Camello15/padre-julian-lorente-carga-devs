import { config } from '../config.js';
import { Alerta } from './modelos.js';

// Memoria de la última alerta enviada por desarrollador para no duplicar mensajes en cada sincronización.
const historialEnviosRocketChat = new Map();

export function limpiarHistorialAlertas() {
  historialEnviosRocketChat.clear();
}

/** Recupera las últimas Alertas enviadas (desde PostgreSQL) para no reenviarlas tras reiniciar el backend. */
export function restaurarHistorialAlertas(enviadas) {
  for (const { desarrolladorId, peticionesAbiertas, umbral } of enviadas) {
    historialEnviosRocketChat.set(desarrolladorId, `${peticionesAbiertas}:${umbral}`);
  }
}

/** Genera una Alerta por cada Desarrollador cuya Carga supera el Umbral (CU-09, RF-12). */
export function generarAlertas(indicadores, umbral, fecha = new Date()) {
  return indicadores
    .filter((indicador) => indicador.superaUmbral)
    .map(
      (indicador) =>
        new Alerta({
          id: `alerta-${indicador.desarrolladorId}-${fecha.getTime()}`,
          desarrolladorId: indicador.desarrolladorId,
          mensaje: `${indicador.nombre} tiene ${indicador.peticionesAbiertas} peticiones abiertas; el umbral es ${umbral.maxPeticiones}.`,
          peticionesAbiertas: indicador.peticionesAbiertas,
          umbral: umbral.maxPeticiones,
          fecha,
          enviadaRocketChat: false,
        }),
    );
}

/**
 * Envía la Alerta al canal de Rocket Chat configurado (CU-09, RF-12).
 * POST {ROCKETCHAT_URL}/api/v1/chat.postMessage
 * Evita reenviar la misma alerta en cada sincronización si la carga y el umbral no cambiaron.
 */
export async function enviarAlertaRocketChat(
  alerta,
  rocketchat = config.fuentes.rocketchat,
  fetchImpl = globalThis.fetch,
) {
  if (config.usarMocks || !rocketchat?.url) {
    return { ...alerta, enviadaRocketChat: false };
  }

  const claveEstado = `${alerta.peticionesAbiertas}:${alerta.umbral}`;
  if (historialEnviosRocketChat.get(alerta.desarrolladorId) === claveEstado) {
    return { ...alerta, enviadaRocketChat: false };
  }

  const baseUrl = rocketchat.url.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/api/v1/chat.postMessage`;

  try {
    const respuesta = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': rocketchat.token ?? '',
        'X-User-Id': rocketchat.userId ?? '',
      },
      body: JSON.stringify({
        channel: rocketchat.canalAlertas ?? '#alertas-ti',
        text: `⚠️ *Alerta de carga TI*: ${alerta.mensaje}`,
      }),
    });

    if (!respuesta.ok) {
      console.warn(`[alertas] Rocket Chat respondió ${respuesta.status} al enviar alerta ${alerta.id}`);
      return { ...alerta, enviadaRocketChat: false };
    }

    historialEnviosRocketChat.set(alerta.desarrolladorId, claveEstado);
    return { ...alerta, enviadaRocketChat: true };
  } catch (error) {
    console.warn(`[alertas] No se pudo enviar alerta ${alerta.id} a Rocket Chat: ${error.message}`);
    return { ...alerta, enviadaRocketChat: false };
  }
}