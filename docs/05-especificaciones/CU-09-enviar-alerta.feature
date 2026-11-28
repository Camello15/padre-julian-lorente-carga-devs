# language: es
# Responsable: Cristina. Requisitos: RF-12. Extiende CU-08.
Característica: CU-09 Enviar alerta
  Como sistema de centralización
  Quiero generar alertas en pantalla y enviarlas al canal de Rocket Chat cuando un desarrollador supera el umbral
  Para notificar oportunamente al área de TI sobre posibles cuellos de botella

  Escenario: Generar y enviar alerta cuando un desarrollador supera el umbral configurado
    Dado que el umbral máximo está configurado en 5 peticiones abiertas
    Y el desarrollador "dev-01" alcanza 6 peticiones abiertas tras la sincronización
    Cuando se procesan las alertas de carga
    Entonces se genera una alerta visible en el dashboard para "dev-01"
    Y se envía el mensaje de notificación al canal configurado de Rocket Chat

  Escenario: Evitar reenvío duplicado de alerta en sincronizaciones consecutivas
    Dado que ya se envió una alerta a Rocket Chat para "dev-01" con su nivel actual de sobrecarga
    Cuando se ejecuta una nueva sincronización sin cambios en su carga sobre el umbral
    Entonces la alerta permanece visible en el dashboard
    Y no se vuelve a enviar un mensaje duplicado al canal de Rocket Chat
