# 4. Casos de uso

## Actores

| Actor | Descripción |
|---|---|
| PMO | Persona de proyectos. Ve la carga de todo el equipo y exporta reportes. |
| Técnico | Desarrollador (rol `TECNICO`). Solo ve su propia carga. |
| Administrativo | Personal administrativo que consulta la carga del equipo. No configura el umbral. |
| Administrador TI | Configura el umbral y revisa los registros no reconocidos. Es el único rol con el permiso `configurar`. |
| Programador de tareas (cron) | Dispara la sincronización cada 15 minutos. |
| SSO de la cooperativa | Autentica a los usuarios. |
| Fuentes | RedMine, GitLab, GLPI y Rocket Chat. |

## Lista de casos de uso

| ID | Caso de uso | Actor | Módulo | Responsable |
|---|---|---|---|---|
| CU-01 | Iniciar sesión con SSO | PMO, Técnico, Administrativo, Administrador TI | Usuario web y seguridad | Camilo |
| CU-02 | Filtrar información | PMO, Técnico, Administrativo, Administrador TI | Usuario web y seguridad | Camilo |
| CU-03 | Consultar dashboard de carga y avance | PMO, Técnico, Administrativo, Administrador TI | Usuario web y seguridad | Camilo |
| CU-04 | Exportar reporte | PMO | Usuario web y seguridad | Camilo |
| CU-05 | Sincronizar fuentes | Programador de tareas (cron) | Integración | Bryan |
| CU-06 | Registrar fallo de fuente | Programador de tareas (cron) | Integración | Bryan |
| CU-07 | Cruzar datos por código | Programador de tareas (cron) | Integración | Bryan |
| CU-08 | Calcular carga y avance | Programador de tareas (cron) | Datos y alertas | Cristina |
| CU-09 | Enviar alerta | Programador de tareas (cron) | Datos y alertas | Cristina |
| CU-10 | Configurar umbral | Administrador TI | Datos y alertas | Cristina |
| CU-11 | Revisar registros no reconocidos | Administrador TI | Datos y alertas | Cristina |

## Relaciones

| Relación | Tipo |
|---|---|
| CU-02 Filtrar información → CU-01 Iniciar sesión con SSO | «include» |
| CU-03 Consultar dashboard → CU-01 Iniciar sesión con SSO | «include» |
| CU-04 Exportar reporte → CU-01 Iniciar sesión con SSO | «include» |
| CU-03 Consultar dashboard → CU-02 Filtrar información | «include» |
| CU-04 Exportar reporte → CU-03 Consultar dashboard | «extend» |
| CU-05 Sincronizar fuentes → CU-07 Cruzar datos por código | «include» |
| CU-05 Sincronizar fuentes → CU-08 Calcular carga y avance | «include» |
| CU-06 Registrar fallo de fuente → CU-05 Sincronizar fuentes | «extend» |
| CU-09 Enviar alerta → CU-08 Calcular carga y avance | «extend» |

```mermaid
flowchart LR
    PMO(["PMO"]) & TEC(["Técnico"]) & ADV(["Administrativo"]) & ATI(["Administrador TI"]) --> CU03
    PMO --> CU04
    CRON(["Programador de tareas (cron)"]) --> CU05
    ATI --> CU10 & CU11
    CU02["CU-02 Filtrar información"] -. include .-> CU01["CU-01 Iniciar sesión con SSO"]
    CU03["CU-03 Consultar dashboard"] -. include .-> CU01
    CU04["CU-04 Exportar reporte"] -. include .-> CU01
    CU03 -. include .-> CU02
    CU04 -. extend .-> CU03
    CU05["CU-05 Sincronizar fuentes"] -. include .-> CU07["CU-07 Cruzar datos por código"]
    CU05 -. include .-> CU08["CU-08 Calcular carga y avance"]
    CU06["CU-06 Registrar fallo de fuente"] -. extend .-> CU05
    CU09["CU-09 Enviar alerta"] -. extend .-> CU08
    CU10["CU-10 Configurar umbral"]
    CU11["CU-11 Revisar registros no reconocidos"]
    CU01 --- SSO(["SSO de la cooperativa"])
    CU05 --- FUE(["Fuentes"])
```

## Fichas de casos de uso

Cada responsable completa la ficha de sus casos de uso. Los escenarios en Gherkin están en [`05-especificaciones/`](05-especificaciones/).

### CU-01 Iniciar sesión con SSO

> Responsable: **Camilo**. Módulo: Usuario web y seguridad. Escenarios: [`CU-01-iniciar-sesion-sso.feature`](05-especificaciones/CU-01-iniciar-sesion-sso.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-01 |
| **Nombre** | Iniciar sesión con SSO |
| **Actores** | PMO, Técnico, Administrativo, Administrador TI; SSO de la cooperativa |
| **Descripción** | Permite que un usuario de la cooperativa ingrese al dashboard con su cuenta del SSO, sin crear otra contraseña. El sistema obtiene su `Rol` y abre una `Sesion` con fecha de expiración. En el prototipo el SSO es simulado: el usuario elige un rol de prueba. |
| **Precondiciones** | El usuario tiene una cuenta en el SSO de la cooperativa con uno de los roles: PMO, Técnico, Administrativo o Administrador TI. |
| **Flujo principal** | 1. El usuario abre la pantalla de inicio de sesión y pulsa **Ingresar con SSO de la cooperativa** (en el prototipo, antes elige un rol de prueba).<br>2. El frontend envía `POST /api/auth/login` con `{ "rol": "PMO" \| "TECNICO" \| "ADMINISTRATIVO" \| "ADMINISTRADOR_TI" }`.<br>3. `ServicioSesiones` valida la identidad, obtiene el `Usuario` y su `Rol` (permisos y `soloPropios`) y crea la `Sesion` con `token`, `inicio` y `expira` (`SSO_DURACION_SESION_MIN`, 480 min por defecto).<br>4. La API responde `201` con la sesión y el frontend muestra el dashboard (CU-03) con el nombre y el rol del usuario en el encabezado. |
| **Flujos alternativos** | **FA-01 (Cerrar sesión):** El usuario pulsa *Cerrar sesión*; el frontend envía `POST /api/auth/logout` (la API elimina la `Sesion`) y borra la sesión guardada en el navegador.<br>**FA-02 (Recuperar sesión):** Si la pestaña ya tiene una `Sesion` guardada (`sessionStorage`) y no ha llegado a `expira`, se entra directo al dashboard. `GET /api/auth/sesion` devuelve los datos de la sesión vigente. |
| **Excepciones** | **EX-01 (Rol inválido):** Si el rol no existe, la API responde `400` y el usuario permanece en el inicio de sesión.<br>**EX-02 (Sesión no válida o expirada):** Cualquier ruta protegida responde `401`; el frontend vuelve al inicio de sesión con el mensaje "Tu sesión expiró. Vuelve a ingresar."<br>**EX-03 (SSO real no configurado):** Con `SSO_MODO` distinto de `mock`, la API responde `501`. |
| **Postcondiciones** | El usuario tiene una `Sesion` válida y todas las demás rutas de la API aceptan su `Authorization: Bearer <token>`. |
| **Requisitos relacionados** | RF-01, RNF-02 |

### CU-02 Filtrar información

> Responsable: **Camilo**. Módulo: Usuario web y seguridad. Escenarios: [`CU-02-filtrar-informacion.feature`](05-especificaciones/CU-02-filtrar-informacion.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-02 |
| **Nombre** | Filtrar información |
| **Actores** | PMO, Técnico, Administrativo, Administrador TI |
| **Descripción** | Permite acotar la información del dashboard por desarrollador, tipo de trabajo, proyecto, módulo del core y rango de fechas. El `Filtro` se aplica igual a la tabla de peticiones, al gráfico de carga y al resumen. |
| **Precondiciones** | El usuario inició sesión (CU-01). Existe al menos una sincronización con datos (CU-05). |
| **Flujo principal** | 1. El frontend obtiene las opciones con `GET /api/catalogos` (desarrolladores, proyectos, módulos del core, tipos y etapas).<br>2. El usuario elige uno o varios filtros en el panel: `desarrollador`, `tipo` (`POA`, `REC`, `INICIATIVA`, `INCIDENTE`), `proyecto`, `modulo`, `desde` y `hasta` (`AAAA-MM-DD`).<br>3. El frontend vuelve a pedir `GET /api/carga` y `GET /api/peticiones` con esos parámetros.<br>4. La API construye el `Filtro` (`crearFiltro`), le aplica la restricción del `Rol` (`aplicarRestriccionRol`) y devuelve solo los datos que cumplen todos los criterios. |
| **Flujos alternativos** | **FA-01 (Técnico):** Si el rol es Técnico (`soloPropios`), el filtro `desarrollador` queda fijo en su propio desarrollador aunque pida otro.<br>**FA-02 (Limpiar filtros):** El usuario pulsa *Limpiar* y el dashboard vuelve a mostrar todos los datos que su rol puede ver.<br>**FA-03 (Rango de fechas):** Una petición entra en el rango si su periodo planificado (`fechaInicio` a `fechaFin`) se cruza con `desde`–`hasta`. |
| **Excepciones** | **EX-01 (Filtro inválido):** Si el tipo no existe, una fecha no tiene el formato `AAAA-MM-DD` o `desde` es posterior a `hasta`, la API responde `400` con el motivo. |
| **Postcondiciones** | El dashboard muestra solo las peticiones, la carga y el resumen que cumplen el `Filtro`. |
| **Requisitos relacionados** | RF-11, RNF-02 |

### CU-03 Consultar dashboard de carga y avance

> Responsable: **Camilo**. Módulo: Usuario web y seguridad. Escenarios: [`CU-03-consultar-dashboard.feature`](05-especificaciones/CU-03-consultar-dashboard.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-03 |
| **Nombre** | Consultar dashboard de carga y avance |
| **Actores** | PMO, Técnico, Administrativo, Administrador TI |
| **Descripción** | Muestra en una sola pantalla la carga y el avance de cada desarrollador, con datos de RedMine, GitLab, GLPI y Rocket Chat ya unificados: resumen, gráfico de carga por tipo de trabajo, alertas y tabla de peticiones con su etapa. |
| **Precondiciones** | El usuario inició sesión (CU-01). |
| **Flujo principal** | 1. El frontend pide `GET /api/catalogos` y `GET /api/alertas`.<br>2. Pide `GET /api/carga` y `GET /api/peticiones` con los filtros vigentes (CU-02).<br>3. La API calcula el `IndicadorCarga` de cada desarrollador visible (`calcularCarga`) y devuelve el resumen: peticiones abiertas, desarrolladores sobre el umbral, fecha y estado de la última sincronización.<br>4. El dashboard muestra el resumen, el gráfico de carga por desarrollador y tipo de trabajo, el panel de alertas y la tabla de peticiones con su etapa y avance estimado (Análisis 10 %, Desarrollo 40 %, Certificación 70 %, Despliegue 90 %, Estabilización 100 %). |
| **Flujos alternativos** | **FA-01 (Técnico):** El título es "Tu carga de trabajo" y solo ve su propia carga, peticiones y alertas.<br>**FA-02 (Administrador TI):** Además ve el panel para configurar el umbral (CU-10) y revisar registros no reconocidos (CU-11).<br>**FA-03 (PMO):** Además ve el botón *Exportar* (CU-04). |
| **Excepciones** | **EX-01 (Sesión expirada):** La API responde `401` y el usuario vuelve a CU-01.<br>**EX-02 (Error del servidor):** El dashboard muestra el mensaje de error sin cerrar la sesión. |
| **Postcondiciones** | El usuario ve la carga y el avance actualizados a la última sincronización. |
| **Requisitos relacionados** | RF-07, RF-08, RF-09, RF-10, RF-12, RNF-03 |

### CU-04 Exportar reporte

> Responsable: **Camilo**. Módulo: Usuario web y seguridad. Escenarios: [`CU-04-exportar-reporte.feature`](05-especificaciones/CU-04-exportar-reporte.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-04 |
| **Nombre** | Exportar reporte |
| **Actores** | PMO |
| **Descripción** | Permite a la PMO descargar en Excel o PDF lo que ve en el dashboard, con los filtros aplicados y la fecha de la última sincronización. **Estado: pendiente (Sprint 4).** Hoy el botón *Exportar* solo muestra el aviso "La exportación a Excel y PDF llega en el Sprint 4." |
| **Precondiciones** | El usuario inició sesión (CU-01) con el rol PMO (permiso `exportar`) y está en el dashboard (CU-03). |
| **Flujo principal** | 1. La PMO pulsa **Exportar** y elige Excel o PDF.<br>2. El frontend pide `GET /api/reportes?formato=xlsx\|pdf` con los filtros vigentes (CU-02).<br>3. La API genera el `Reporte` con las peticiones filtradas y la fecha de la última sincronización (`fechaUltimaSync`).<br>4. El navegador descarga el archivo. |
| **Flujos alternativos** | Ninguno. |
| **Excepciones** | **EX-01 (Sin permiso):** Los roles Técnico, Administrativo y Administrador TI no ven el botón *Exportar*; si llaman a la ruta, la API responde `403`. |
| **Postcondiciones** | La PMO tiene un archivo Excel o PDF con los mismos datos que veía en el dashboard. |
| **Requisitos relacionados** | RF-13 |

### CU-05 Sincronizar fuentes

> Responsable: **Bryan**. Módulo: Integración. Escenarios: [`CU-05-sincronizar-fuentes.feature`](05-especificaciones/CU-05-sincronizar-fuentes.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-05 |
| **Nombre** | Sincronizar fuentes |
| **Actores** | Programador de tareas (cron); Fuentes |
| **Descripción** | Lee RedMine, GitLab, GLPI y Rocket Chat como fuentes. Cruza las Peticiones de RedMine con incidentes de GLPI y actividades de GitLab; Rocket Chat aporta notificaciones vinculadas por código a Peticiones reconocidas. Actualiza datos e indicadores cada 15 minutos. |
| **Precondiciones** | El programador de tareas tiene una expresión cron válida y los conectores de las fuentes están registrados. |
| **Flujo principal** | 1. El programador de tareas dispara la sincronización según la expresión cron.<br>2. El sistema lee RedMine, GitLab, GLPI y Rocket Chat en paralelo y conserva los datos recibidos por cada conector.<br>3. El sistema cruza las Peticiones de RedMine con GLPI y GitLab, obtiene notificaciones de Rocket Chat que mencionan códigos reconocidos (CU-07), calcula carga y avance (CU-08), genera las alertas correspondientes y guarda el resultado con estado global `ok` si ninguna fuente falla. |
| **Flujos alternativos** | **FA-01 (Falla una o más fuentes):** Tras agotar tres intentos, CU-06 registra cada fallo y la sincronización continúa con los últimos datos exitosos disponibles en memoria para esa fuente; si no existen, continúa con una lista vacía. El estado global queda `parcial` si falló parte de las fuentes o `fallida` si fallaron todas.<br>**FA-02 (Ya hay una sincronización en ejecución):** El sistema no inicia otra ejecución y devuelve `null`. |
| **Excepciones** | No se especifican excepciones de negocio adicionales. |
| **Postcondiciones** | Al terminar la ejecución se guarda el estado global (`ok`, `parcial` o `fallida`), los datos unificados, indicadores, alertas y la cantidad de registros no reconocidos. |
| **Requisitos relacionados** | RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-12, RNF-01, RNF-04. Incluye CU-07 y CU-08; CU-06 extiende este caso. |

### CU-06 Registrar fallo de fuente

> Responsable: **Bryan**. Módulo: Integración. Escenarios: [`CU-06-registrar-fallo-fuente.feature`](05-especificaciones/CU-06-registrar-fallo-fuente.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-06 |
| **Nombre** | Registrar fallo de fuente |
| **Actores** | Programador de tareas (cron) |
| **Descripción** | Registra el fallo de una Fuente cuando su Conector no logra leerla después de tres intentos y permite que CU-05 continúe usando los últimos datos exitosos disponibles en el almacén en memoria. |
| **Precondiciones** | CU-05 está leyendo las fuentes y el Conector de una Fuente ha agotado los tres intentos de lectura. |
| **Flujo principal** | 1. El sistema obtiene el último error de lectura de la Fuente y el número de intentos realizados.<br>2. Registra la Fuente, fecha, número de intentos y mensaje del error en `estadoSincronizacion.fallos`.<br>3. Recupera los últimos datos exitosos disponibles de esa Fuente en el almacén en memoria y los entrega a CU-05 para continuar la sincronización. |
| **Flujos alternativos** | **FA-01 (Sin datos anteriores):** Si no existe una lectura exitosa previa en el almacén en memoria, CU-05 continúa con una lista vacía para esa Fuente y la marca `sin-datos`; este es un estado individual de la Fuente, no el estado global de sincronización. |
| **Excepciones** | No se especifican excepciones de negocio adicionales. |
| **Postcondiciones** | El fallo queda incluido en `estadoSincronizacion.fallos` y se reutilizan los últimos datos exitosos disponibles en memoria; si no existen, la Fuente aporta cero registros a esa ejecución. Con PostgreSQL y conectores reales, `RepositorioSincronizacionPostgres` también guarda esos datos en `snapshot_fuente`, así que se recuperan al reiniciar el backend; con mocks, solo están en memoria. |
| **Requisitos relacionados** | RNF-01. Extiende CU-05. |

### CU-07 Cruzar datos por código

> Responsable: **Bryan**. Módulo: Integración. Escenarios: [`CU-07-cruzar-datos-por-codigo.feature`](05-especificaciones/CU-07-cruzar-datos-por-codigo.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-07 |
| **Nombre** | Cruzar datos por código |
| **Actores** | Programador de tareas (cron) |
| **Descripción** | Extrae códigos de Petición (`POA-AAAA-NNN`, `REC-AAAA-NNN`, `INC-AAAA-NNN` e `iniciativa.ti.NNN`) sin distinguir mayúsculas y minúsculas; normaliza los tres formatos estándar a mayúsculas e `iniciativa.ti` a minúsculas. Usa el código para cruzar RedMine con GLPI y GitLab, eliminar duplicados y separar datos no reconocidos. En GitLab busca primero en la rama y, si no encuentra código, en el título. |
| **Precondiciones** | CU-05 obtuvo los datos disponibles de las fuentes y los desarrolladores están disponibles para relacionar sus identificadores de origen. |
| **Flujo principal** | 1. El sistema normaliza las peticiones de RedMine y valida código, tipo de trabajo y etapa; si hay duplicados, conserva el primer registro que supera las tres validaciones.<br>2. Cruza los incidentes de GLPI y las actividades de GitLab con las peticiones por código, relacionando los desarrolladores cuando hay coincidencia. Para GitLab busca primero en la rama y luego en el título si la rama no contiene código.<br>3. Obtiene de RedMine el campo `Módulo del core`; incluye sus módulos en `modulosConCambios` solo para peticiones con actividad GitLab asociada. Devuelve también las notificaciones de Rocket Chat que mencionan códigos reconocidos. |
| **Flujos alternativos** | **FA-01 (Registro no reconocido):** Se crea `RegistroNoReconocido` si RedMine tiene código inválido o ausente, tipo desconocido o etapa inválida; si GLPI no tiene código o este no corresponde a una Petición; o si GitLab no permite extraer un código o el código extraído no corresponde a una Petición. El registro incluye fuente, `codigoOriginal`, motivo, fecha de detección y `revisado = false`. En RedMine, `codigoOriginal` es el texto del campo Código o `redmine#id` si no existe; en GLPI, es el código o `glpi#id` si no existe; en GitLab, es el nombre de la rama incluso si el código se extrajo del título. Los mensajes de Rocket Chat sin Petición coincidente no generan `RegistroNoReconocido`. |
| **Excepciones** | No se especifican excepciones de negocio adicionales. |
| **Postcondiciones** | Se devuelven peticiones unificadas sin duplicados, proyectos, módulos del core con cambios, notificaciones coincidentes y registros no reconocidos para revisión (CU-11). |
| **Requisitos relacionados** | RF-06, RF-07, RF-09. Es incluido por CU-05; los registros no reconocidos quedan disponibles para CU-11. |

### CU-08 Calcular carga y avance

> Responsable: **Cristina**. Módulo: Datos y alertas. Escenarios: [`CU-08-calcular-carga-avance.feature`](05-especificaciones/CU-08-calcular-carga-avance.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-08 |
| **Nombre** | Calcular carga y avance |
| **Actores** | Programador de tareas (cron) |
| **Descripción** | Calcula la cantidad de peticiones abiertas asignadas a cada desarrollador, las clasifica por tipo de trabajo, estima su avance promedio según la etapa de RedMine y evalúa si supera el umbral configurado. |
| **Precondiciones** | Existen desarrolladores activos y peticiones normalizadas tras ejecutar la sincronización (CU-05 y CU-07). |
| **Flujo principal** | 1. El sistema filtra las peticiones en estado `abierta` asignadas a cada desarrollador.<br>2. Clasifica las peticiones abiertas por `TipoTrabajo` (`POA`, `REC`, `INICIATIVA`, `INCIDENTE`).<br>3. Estima el porcentaje de avance de cada petición según su `Etapa` (10 %, 40 %, 70 %, 90 %, 100 %) y obtiene el promedio.<br>4. Compara el total de peticiones abiertas contra `Umbral.maxPeticiones` y genera el `IndicadorCarga`. |
| **Flujos alternativos** | **FA-01 (Sin peticiones abiertas):** Si el desarrollador no tiene peticiones abiertas, su carga es `0`, su avance promedio es `0 %` y `superaUmbral` es `false`. |
| **Excepciones** | **EX-01 (Etapa no reconocida):** Si una petición tiene una etapa fuera del catálogo, su avance estimado se toma como `0 %` sin interrumpir el cálculo del resto. |
| **Postcondiciones** | Se almacenan los indicadores actualizados (`IndicadorCarga`) disponibles para consulta en el dashboard y evaluación de alertas (CU-09). |
| **Requisitos relacionados** | RF-08, RF-10 |

### CU-09 Enviar alerta

> Responsable: **Cristina**. Módulo: Datos y alertas. Escenarios: [`CU-09-enviar-alerta.feature`](05-especificaciones/CU-09-enviar-alerta.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-09 |
| **Nombre** | Enviar alerta |
| **Actores** | Programador de tareas (cron) |
| **Descripción** | Genera una alerta visible en el dashboard y envía una notificación al canal de Rocket Chat configurado cuando la carga de un desarrollador supera el umbral permitido. |
| **Precondiciones** | Se ha ejecutado el cálculo de carga (CU-08) y existe al menos un desarrollador con `peticionesAbiertas > umbral.maxPeticiones`. |
| **Flujo principal** | 1. El sistema identifica los indicadores donde `superaUmbral` es verdadero.<br>2. Crea un objeto `Alerta` con el detalle del desarrollador, sus peticiones abiertas y el umbral vigente.<br>3. Verifica si ya se envió previamente esa misma alerta para evitar notificaciones duplicadas.<br>4. Envía el mensaje mediante `POST /api/v1/chat.postMessage` a Rocket Chat y registra la alerta en el almacén. |
| **Flujos alternativos** | **FA-01 (Modo pruebas o sin Rocket Chat):** Si `usarMocks` está activo o no hay URL configurada, la alerta se registra en pantalla con `enviadaRocketChat = false`.<br>**FA-02 (Alerta ya notificada):** Si la carga sobre el umbral no cambió desde el último envío para ese desarrollador, se mantiene la alerta en pantalla sin reenviar mensaje a Rocket Chat. |
| **Excepciones** | **EX-01 (Fallo de conexión con Rocket Chat):** Si la API de Rocket Chat responde con error o timeout, se registra el error en bitácora y la alerta queda visible en el dashboard sin abortar la sincronización. |
| **Postcondiciones** | Las alertas vigentes quedan disponibles en `GET /api/alertas` y notificadas en Rocket Chat. |
| **Requisitos relacionados** | RF-12 |

### CU-10 Configurar umbral

> Responsable: **Cristina**. Módulo: Datos y alertas. Escenarios: [`CU-10-configurar-umbral.feature`](05-especificaciones/CU-10-configurar-umbral.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-10 |
| **Nombre** | Configurar umbral |
| **Actores** | Administrador TI |
| **Descripción** | Permite al Administrador TI modificar el límite máximo de peticiones abiertas por desarrollador antes de disparar alertas de sobrecarga. |
| **Precondiciones** | El usuario ha iniciado sesión (CU-01) y tiene el rol Administrador TI (permiso `configurar`). |
| **Flujo principal** | 1. El Administrador TI envía el nuevo valor entero positivo para `maxPeticiones`.<br>2. El sistema valida que el valor sea un entero mayor o igual a `1`.<br>3. Actualiza el umbral vigente registrando quién realizó el cambio y la fecha.<br>4. Recalcula el indicador `superaUmbral` y las alertas vigentes con el nuevo límite. |
| **Flujos alternativos** | Ninguno. |
| **Excepciones** | **EX-01 (Valor inválido):** Si `maxPeticiones` no es un entero positivo (`<= 0` o no numérico), el sistema devuelve HTTP `400` y conserva el umbral previo.<br>**EX-02 (Sin permisos):** Si un usuario sin el rol Administrador TI (por ejemplo, Administrativo) intenta modificar el umbral, el sistema devuelve HTTP `403`. |
| **Postcondiciones** | El nuevo umbral queda activo para las consultas inmediatas y futuras sincronizaciones. |
| **Requisitos relacionados** | RF-12, RNF-02 |

### CU-11 Revisar registros no reconocidos

> Responsable: **Cristina**. Módulo: Datos y alertas. Escenarios: [`CU-11-revisar-registros-no-reconocidos.feature`](05-especificaciones/CU-11-revisar-registros-no-reconocidos.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-11 |
| **Nombre** | Revisar registros no reconocidos |
| **Actores** | Administrador TI |
| **Descripción** | Permite consultar los registros provenientes de GitLab, GLPI o Rocket Chat cuyo código no coincidió con ninguna petición de RedMine durante el cruce (CU-07), para asociarlos manualmente o marcarlos como revisados. |
| **Precondiciones** | El usuario ha iniciado sesión (CU-01) con el rol Administrador TI y existen registros detectados en `RegistroNoReconocido`. |
| **Flujo principal** | 1. El Administrador TI consulta el listado de registros no reconocidos pendientes.<br>2. El sistema muestra la fuente de origen, código original, motivo y fecha de detección.<br>3. El administrador selecciona un registro y lo marca como revisado (o lo vincula a un código de petición válido).<br>4. El sistema actualiza el estado del registro a `revisado = true`. |
| **Flujos alternativos** | **FA-01 (Filtrar por estado):** El administrador puede consultar tanto los registros pendientes como los ya revisados. |
| **Excepciones** | **EX-01 (Registro inexistente):** Si el identificador enviado no existe, el sistema responde HTTP `404`.<br>**EX-02 (Sin permisos):** Si el usuario no tiene el rol Administrador TI, el sistema responde HTTP `403`. |
| **Postcondiciones** | El registro queda marcado como revisado y disminuye el contador de registros pendientes en el resumen de sincronización. |
| **Requisitos relacionados** | RF-06 |
