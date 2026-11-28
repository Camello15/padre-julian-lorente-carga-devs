# 2. Requisitos

## Requisitos funcionales

| Código | Requisito | Prioridad |
|---|---|---|
| RF-01 | Iniciar sesión con el SSO de la cooperativa | Alta |
| RF-02 | Obtener de RedMine las peticiones (POA, REC, iniciativas, incidentes) y su etapa | Alta |
| RF-03 | Obtener de GitLab commits, merge requests y pipelines por desarrollador | Alta |
| RF-04 | Obtener de GLPI los incidentes asignados | Alta |
| RF-05 | Obtener de Rocket Chat notificaciones relevantes | Media |
| RF-06 | Unificar datos por desarrollador y eliminar duplicados | Alta |
| RF-07 | Clasificar por tipo de trabajo (POA, REC, Iniciativa, Incidente) | Alta |
| RF-08 | Mostrar el avance por etapa de RedMine | Alta |
| RF-09 | Mostrar los módulos del core financiero con cambios | Media |
| RF-10 | Indicadores de carga y productividad por desarrollador | Alta |
| RF-11 | Filtros: desarrollador, tipo, proyecto, módulo, fechas | Alta |
| RF-12 | Alertas en pantalla y por Rocket Chat al superar el umbral | Media |
| RF-13 | Exportar a Excel o PDF | Media |

## Requisitos no funcionales

| Código | Requisito |
|---|---|
| RNF-01 | Sincronización automática cada 15 min; si una fuente falla (3 reintentos), se usan los últimos datos. |
| RNF-02 | Seguridad. Solo usuarios autorizados; credenciales de APIs en variables de entorno, nunca en el código. |
| RNF-03 | Interfaz sencilla, en lenguaje claro. |
| RNF-04 | Extensible. Cada fuente es un conector; agregar otra no obliga a rehacer el sistema. |
| RNF-05 | Open source y Docker. |
| RNF-06 | Documentado (manual técnico y de usuario). |

## Avance por etapa (RF-08)

Como RedMine no registra el avance real, el avance de cada petición se estima según su etapa:

| Etapa | Avance |
|---|---|
| Análisis | 10 % |
| Desarrollo | 40 % |
| Certificación | 70 % |
| Despliegue | 90 % |
| Estabilización | 100 % |

> **Nota:** estos porcentajes son una **propuesta del equipo, pendiente de validar con la cooperativa**. Están definidos como constantes en `backend/src/datos/avance.js` y se pueden cambiar sin tocar el código con la variable de entorno `AVANCE_POR_ETAPA`.

## Trazabilidad con el código

| Requisito | Dónde está |
|---|---|
| RF-01 | `backend/src/auth/`, `frontend/src/paginas/Login.jsx` |
| RF-02 a RF-05 | `backend/src/conectores/` |
| RF-06, RF-07, RF-09 | `backend/src/sincronizacion/normalizador.js` |
| RF-08 | `backend/src/datos/avance.js`, `frontend/src/componentes/RielEtapas.jsx` |
| RF-10 | `backend/src/datos/carga.js`, `frontend/src/componentes/GraficoCarga.jsx` |
| RF-11 | `backend/src/datos/filtro.js`, `frontend/src/componentes/PanelFiltros.jsx` |
| RF-12 | `backend/src/datos/alertas.js`, `frontend/src/componentes/PanelAlertas.jsx` |
| RF-13 | Pendiente (botón Exportar en el dashboard) |
| RNF-01 | `backend/src/sincronizacion/Sincronizacion.js`, `programador.js` |
| RNF-02 | `backend/src/auth/middleware.js`, `.env.example` |
| RNF-04 | `backend/src/conectores/Conector.js`, `conectores/index.js` |
| RNF-05 | `docker-compose.yml`, `*/Dockerfile` |
