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