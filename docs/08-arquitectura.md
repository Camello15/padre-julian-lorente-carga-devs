# 8. Documentación de la arquitectura

**Sistema:** Dashboard de carga de desarrolladores · **Organización:** COAC Padre Julián Lorente (Loja, Ecuador) · **Reto 2 UTPL**

Este documento describe la arquitectura del prototipo que está en la rama `develop`. Los diagramas citados están en [diagramas/](diagramas/README.md) y los nombres coinciden con el código.

---

## 1. Propósito y alcance

El área de TI de la cooperativa (1 PMO y 7 desarrolladores) reparte su trabajo entre cuatro herramientas que no están conectadas: RedMine (peticiones), GitLab (código, Gitflow), GLPI (mesa de ayuda) y Rocket Chat (comunicación). El sistema **lee las cuatro por API cada 15 minutos, une los datos de cada petición por su código y muestra en un solo dashboard la carga, el avance y las alertas de sobrecarga** de cada desarrollador.

| | Incluido en el prototipo | Pendiente |
|---|---|---|
| Casos de uso | CU-01 a CU-03 y CU-05 a CU-11 | CU-04 Exportar reporte (RF-13) |
| Autenticación | SSO simulado (`SSO_MODO=mock`) con 4 roles | SSO real de la cooperativa (protocolo por confirmar) |
| Fuentes | Conectores reales programados y datos de prueba (`USAR_MOCKS=true`) | Credenciales y RedMine de pruebas de la cooperativa |
| Persistencia | PostgreSQL 17 (sincronización, datos y alertas) | Sesiones y reportes en BD, retención de históricos |
| Despliegue | Docker Compose (3 contenedores) | Despliegue en la infraestructura de la cooperativa |

Ubicación en el negocio: actividad de apoyo **Desarrollo tecnológico** de la cadena de valor ([diagrama 1](diagramas/README.md#1-cadena-de-valor)); recorrido completo en el flujo de valor ([diagrama 2](diagramas/README.md#2-flujo-de-valor)).

## 2. Restricciones y decisiones de la cooperativa

1. Integrar las herramientas por API, sin reemplazarlas ni replicarlas.
2. No priorizar peticiones con algoritmos: las prioridades cambian por normativa externa.
3. El avance se estima según la etapa de RedMine, porque RedMine no registra el avance real.
4. Software libre y Docker (las herramientas de la cooperativa ya corren on-premise en Docker).
5. Ingreso con el SSO de la cooperativa, sin contraseñas propias.
6. Interfaz sencilla y en español.

## 3. Atributos de calidad

| Requisito | Atributo | Mecanismo en la arquitectura |
|---|---|---|
| RNF-01 | Disponibilidad | Sincronización cada 15 min (`SYNC_CRON`), 3 reintentos por fuente, uso de los últimos datos buenos, recuperación de sincronizaciones `en-curso` al arrancar |
| RNF-02 | Seguridad | SSO, token Bearer de 480 min, permisos por rol validados en el servidor (`requiereSesion`, `requierePermiso`, `aplicarRestriccionRol`), credenciales solo en variables de entorno, PostgreSQL solo en `127.0.0.1` |
| RNF-03 | Usabilidad | Interfaz React en español con roles de prueba, filtros y gráfico de carga |
| RNF-04 | Extensibilidad | Patrón Adapter: una fuente nueva es una subclase más de `Conector` |
| RNF-05 | Portabilidad | Software libre y `docker compose up --build` sin configuración previa |
| RNF-06 | Mantenibilidad | Módulos por responsable, 113 pruebas automáticas, CI con lint, cobertura y SonarQube Cloud |

## 4. Estilo arquitectónico

**Monolito modular de tres capas**, desplegado en tres contenedores:

| Capa | Tecnología | Contenedor |
|---|---|---|
| Presentación | React + Vite + Chart.js | `frontend` (nginx 1.27, puerto 8080) |
| Lógica y API | Node.js 22 + Express 5 + node-cron | `backend` (puerto 3000) |
| Datos | PostgreSQL 17 | `postgres` (puerto 5432, solo el anfitrión) |

El backend se organiza en tres módulos alineados con el equipo:

| Módulo | Responsabilidad | Paquetes |
|---|---|---|
| Usuario web y seguridad | Ingreso, sesión, roles, filtros y dashboard | `frontend/src`, `backend/src/auth`, `rutas/auth.js`, `datos/filtro.js` |
| Integración | Conectores, sincronización programada, cruce por código y fallos | `conectores`, `sincronizacion`, `RepositorioSincronizacionPostgres` |
| Datos y alertas | Carga, avance, umbral, alertas, registros no reconocidos y persistencia | `datos` (`carga`, `avance`, `alertas`, `modelos`, `AlmacenPostgres`), `rutas/datos.js` |

## 5. Vistas (modelo 4+1)

| Vista | Pregunta que responde | Diagrama |
|---|---|---|
| Escenarios | ¿Quién usa el sistema y para qué? | [4. Casos de uso](diagramas/README.md#4-casos-de-uso) |
| Lógica | ¿Qué conceptos y responsabilidades hay? | [5. Clases](diagramas/README.md#5-clases) |
| Procesos | ¿Cómo colaboran los elementos en ejecución? | [6. Secuencia por caso de uso](diagramas/README.md#6-diagramas-de-secuencia) |
| Desarrollo | ¿Cómo está organizado el código? | [7. Componentes](diagramas/README.md#7-componentes) y [8. Paquetes](diagramas/README.md#8-paquetes) |
| Física | ¿Dónde se ejecuta cada parte? | [9. Despliegue](diagramas/README.md#9-despliegue) |

### 5.1 Escenarios

| Rol | Clave | Permisos | Casos de uso |
|---|---|---|---|
| PMO | `PMO` | `ver:todos`, `exportar` | CU-01, CU-02, CU-03, CU-04 |
| Técnico | `TECNICO` | `ver:propios` (solo su carga) | CU-01, CU-02, CU-03 |
| Administrativo | `ADMINISTRATIVO` | `ver:todos` | CU-01, CU-02, CU-03 |
| Administrador TI | `ADMINISTRADOR_TI` | `ver:todos`, `configurar` | CU-01, CU-02, CU-03, CU-10, CU-11 |
| Programador de tareas (cron) | — | — | CU-05 (incluye CU-07 y CU-08; extendido por CU-06 y CU-09) |

### 5.2 Lógica

- **Usuario web y seguridad:** `ServicioSesiones` crea y valida las sesiones; `Rol` define permisos y `soloPropios`. `Usuario`, `Sesion` y `Filtro` son objetos conceptuales; `Reporte` está pendiente.
- **Integración:** `Conector` (abstracta) y sus subclases `ConectorRedmine`, `ConectorGitlab`, `ConectorGlpi` y `ConectorRocketChat`. `Sincronizacion` orquesta la lectura, el cruce y el cálculo. `AlmacenMemoria` es la caché de lectura y guarda el snapshot y el cursor de cada fuente. `RepositorioSincronizacionPostgres` persiste `sincronizacion`, `registro_fallo` y `snapshot_fuente`.
- **Datos y alertas:** `Peticion`, `ActividadCodigo`, `Desarrollador`, `Proyecto`, `ModuloCore`, `IndicadorCarga`, `Umbral`, `Alerta`, `RegistroNoReconocido` y las enumeraciones `TipoTrabajo` y `Etapa`. `AlmacenPostgres` hereda de `AlmacenMemoria` y persiste los datos y alertas.

### 5.3 Procesos

Hay dos flujos principales:

1. **Sincronización (CU-05):** `programador.js` → `Sincronizacion.ejecutar()` → las 4 fuentes se leen en paralelo con reintentos → `normalizador.unificar()` → `calcularCarga()` → `generarAlertas()` → `RepositorioSincronizacionPostgres.finalizarSincronizacion()` → `enviarAlertaRocketChat()` → `AlmacenPostgres.guardarResultado()`. Cada escritura en PostgreSQL ocurre en su propia transacción.
2. **Consulta (CU-01 a CU-03):** navegador → `api.js` → `/api/*` → `requiereSesion` → `rutas/datos.js` → filtro y cálculo sobre la caché en memoria → JSON. Las lecturas no consultan PostgreSQL.

### 5.4 Desarrollo

API REST que expone el backend:

| Método y ruta | Permiso | Caso de uso |
|---|---|---|
| `GET /api/salud` | público | — |
| `POST /api/auth/login`, `GET /api/auth/sesion`, `POST /api/auth/logout` | público / sesión | CU-01 |
| `GET /api/catalogos`, `GET /api/carga`, `GET /api/peticiones` | sesión (`ver:todos` o `ver:propios`) | CU-02, CU-03 |
| `GET /api/alertas` | sesión | CU-09 |
| `GET /api/sincronizacion/estado` | sesión | CU-05, CU-06 |
| `PUT /api/umbral` | `configurar` | CU-10 |
| `GET /api/registros-no-reconocidos`, `PATCH /api/registros-no-reconocidos/:id` | `configurar` | CU-11 |
| `GET /api/reportes` «pendiente» | `exportar` | CU-04 |

Dependencias entre paquetes sin ciclos: `datos` no importa `sincronizacion` ni `rutas`; `conectores` solo depende de `config`; el frontend se comunica con el backend solo por HTTP.

### 5.5 Física

`docker compose up --build` levanta `frontend` (nginx reenvía `/api/` a `backend:3000`), `backend` (espera a que `postgres` esté sano) y `postgres` (inicializado con `database/schema.sql`, 18 tablas, volumen `datos-postgres`). El backend se conecta por HTTPS a RedMine, GitLab, GLPI y Rocket Chat dentro de la red de la cooperativa. En desarrollo se usa `npm run dev` (Vite en el puerto 5173 y backend en el 3000); sin `DATABASE_URL`, todo queda en memoria.

## 6. Decisiones de arquitectura

| ID | Decisión | Motivo | Consecuencia |
|---|---|---|---|
| AD-01 | Conectores con patrón Adapter (`Conector` abstracta y una subclase por fuente) | Integrar sin replicar; RNF-04 | Una fuente nueva = una subclase y una línea en `conectores/index.js`. Cada conector maneja la autenticación y paginación de su API |
| AD-02 | Lectura incremental con cursor y snapshot por fuente (`snapshot_fuente`) | Reducir la carga sobre las APIs de la cooperativa | Cada lectura pide solo lo modificado desde el cursor menos 5 minutos de solapamiento |
| AD-03 | Tolerancia a fallos: 3 reintentos, últimos datos buenos, nunca dos sincronizaciones a la vez | RNF-01 | El dashboard nunca queda vacío; el estado de la sincronización queda `parcial` o `fallida` |
| AD-04 | Caché en memoria y persistencia transaccional en PostgreSQL con dos escritores sobre el mismo pool | Lecturas rápidas sin cambiar las rutas; no perder datos al reiniciar | `RepositorioSincronizacionPostgres` (Integración) y `AlmacenPostgres` (Datos y alertas); al arrancar se rehidratan el umbral, los snapshots, las revisiones y el historial de alertas |
| AD-05 | El código de la petición (`POA-AAAA-NNN`, `REC-…`, `INC-…`, `iniciativa.ti.NNN`) como clave de integración | RedMine es la fuente principal | Sin duplicados; lo que no se cruza pasa a `RegistroNoReconocido` para revisión humana (CU-11) |
| AD-06 | Avance estimado por etapa: 10, 40, 70, 90 y 100 % | RedMine no registra el avance real | Configurable con `AVANCE_POR_ETAPA`; por validar con la cooperativa |
| AD-07 | Seguridad por roles en el servidor | RNF-02 | 401 sin sesión, 403 sin permiso; el Técnico solo recibe sus datos aunque manipule la petición |
| AD-08 | Alertas sin duplicados | Evitar ruido en `#ti-alertas` | Solo se reenvía si cambian la carga o el umbral; el historial se restaura desde PostgreSQL |
| AD-09 | Software libre y Docker Compose | RNF-05 | Se levanta con un solo comando, sin configuración previa |
| AD-10 | Pruebas automáticas e integración continua | Calidad y trabajo en equipo | `node:test` (incluye integración con PostgreSQL), Vitest, lint, cobertura y SonarQube Cloud en GitHub Actions |

## 7. Riesgos y deuda técnica

| Riesgo o deuda | Impacto | Mitigación prevista |
|---|---|---|
| SSO real sin definir (OIDC, SAML o CAS) | El ingreso real no está probado | El punto de conexión es `POST /api/auth/login` en `rutas/auth.js` (hoy responde 501 si `SSO_MODO` no es `mock`); el resto usa solo el token |
| Nombres de campos personalizados de RedMine ("Código", "Etapa", "Módulo del core") supuestos | El cruce podría fallar con datos reales | Validar con el RedMine de pruebas; los nombres están en `normalizador.js` y `modelos.js` |
| Sesiones en memoria | Al reiniciar el backend hay que volver a ingresar | Persistir en la tabla `sesion` (ya existe en el esquema) |
| Sin transacción distribuida entre PostgreSQL y Rocket Chat | Una alerta podría enviarse sin quedar registrada | Riesgo aceptado; el historial evita reenvíos |
| `indicador_carga` crece unas 7 filas por sincronización | Crecimiento de la base | Definir una política de retención |
| CU-04 pendiente | No hay exportación | Diseño en la secuencia CU-04 (Sprint 4) |

## 8. Trazabilidad

| Caso de uso | Requisitos | Frontend | Endpoint | Backend | Tablas |
|---|---|---|---|---|---|
| CU-01 | RF-01, RNF-02 | `Login.jsx`, `App.jsx` | `/api/auth/*` | `ServicioSesiones`, `roles.js` | `usuario`, `rol` |
| CU-02 | RF-11 | `PanelFiltros.jsx` | `/api/carga`, `/api/peticiones` | `filtro.js` | — (caché) |
| CU-03 | RF-07 a RF-10 | `Dashboard.jsx` y componentes | `/api/catalogos`, `/api/carga`, `/api/peticiones` | `carga.js`, `AlmacenMemoria` | — (caché) |
| CU-04 | RF-13 | botón *Exportar* | `/api/reportes` «pendiente» | `Reporte` «pendiente» | `reporte` |
| CU-05 | RF-02 a RF-05, RNF-01 | — | `/api/sincronizacion/estado` | `programador.js`, `Sincronizacion`, `Conector*` | `sincronizacion`, `snapshot_fuente` |
| CU-06 | RNF-01 | — | `/api/sincronizacion/estado` | `Sincronizacion.leerConReintentos` | `registro_fallo` |
| CU-07 | RF-06, RF-09 | — | — | `normalizador.js` | `peticion`, `actividad_codigo`, `peticion_modulo` |
| CU-08 | RF-08, RF-10 | `GraficoCarga.jsx` | `/api/carga` | `carga.js`, `avance.js` | `indicador_carga` |
| CU-09 | RF-12 | `PanelAlertas.jsx` | `/api/alertas` | `alertas.js` | `alerta` |
| CU-10 | RF-12 | `PanelAdministracionTI.jsx` | `PUT /api/umbral` | `rutas/datos.js`, `AlmacenPostgres` | `umbral` |
| CU-11 | RF-06 | `PanelAdministracionTI.jsx` | `/api/registros-no-reconocidos` | `AlmacenPostgres` | `registro_no_reconocido` |
