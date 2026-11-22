import { fileURLToPath } from 'node:url';

// Carga el .env de la raíz del repositorio si existe (Node 20.12+). En Docker las variables llegan por el entorno.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  // Sin .env: se usan los valores por defecto.
}

const entero = (valor, porDefecto) => {
  const numero = Number.parseInt(valor ?? '', 10);
  return Number.isNaN(numero) ? porDefecto : numero;
};

const texto = (valor, porDefecto = '') => (valor && valor.trim() !== '' ? valor.trim() : porDefecto);

/** Configuración central. Las credenciales solo se leen del entorno (RNF-02). */
export const config = Object.freeze({
  databaseUrl: texto(process.env.DATABASE_URL),
  puerto: entero(process.env.PORT, 3000),
  origenFrontend: texto(process.env.FRONTEND_URL, 'http://localhost:5173'),
  usarMocks: texto(process.env.USAR_MOCKS, 'true') !== 'false',
  mockFallaFuente: texto(process.env.MOCK_FALLA_FUENTE),
  sso: {
    modo: texto(process.env.SSO_MODO, 'mock'),
    url: texto(process.env.SSO_URL),
    duracionSesionMin: entero(process.env.SSO_DURACION_SESION_MIN, 480),
  },
  sincronizacion: {
    cron: texto(process.env.SYNC_CRON, '*/15 * * * *'),
    reintentos: entero(process.env.SYNC_REINTENTOS, 3),
    esperaReintentoMs: entero(process.env.SYNC_ESPERA_REINTENTO_MS, 2000),
  },
  umbral: {
    maxPeticiones: entero(process.env.UMBRAL_MAX_PETICIONES, 6),
  },
  avancePorEtapaJson: texto(process.env.AVANCE_POR_ETAPA),
  fuentes: {
    redmine: { url: texto(process.env.REDMINE_URL), apiKey: process.env.REDMINE_API_KEY ?? '' },
    gitlab: {
      url: texto(process.env.GITLAB_URL),
      token: process.env.GITLAB_TOKEN ?? '',
      projectIds: texto(process.env.GITLAB_PROJECT_IDS).split(',').map((id) => id.trim()).filter(Boolean),
    },
    glpi: {
      url: texto(process.env.GLPI_URL),
      appToken: process.env.GLPI_APP_TOKEN ?? '',
      userToken: process.env.GLPI_USER_TOKEN ?? '',
    },
    rocketchat: {
      url: texto(process.env.ROCKETCHAT_URL),
      userId: process.env.ROCKETCHAT_USER_ID ?? '',
      token: process.env.ROCKETCHAT_TOKEN ?? '',
      canalesLectura: [...new Set(texto(process.env.ROCKETCHAT_CANALES_LECTURA).split(',').map((canal) => canal.trim()).filter(Boolean))],
      canalAlertas: texto(process.env.ROCKETCHAT_CANAL_ALERTAS, '#ti-alertas'),
    },
  },
});
