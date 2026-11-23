# language: es
# Responsable: Bryan. Requisitos: RNF-01. Extiende CU-05.
Característica: CU-06 Registrar fallo de fuente
  Como Programador de tareas (cron)
  Quiero registrar cuando una fuente no responde y seguir con sus últimos datos
  Para que la caída de una herramienta no deje el dashboard vacío

  Escenario: Una fuente falla tras 3 intentos y hay datos anteriores
    Dado que GLPI respondió en la sincronización anterior
    Y ahora GLPI no responde
    Cuando la sincronización intenta leer GLPI 3 veces sin éxito
    Entonces se registra un fallo de GLPI con 3 intentos y el mensaje de error
    Y se usan los últimos datos guardados de GLPI
    Y el estado de GLPI es "con-datos-anteriores"
    Y el estado de la sincronización es "parcial"

  Escenario: Una fuente falla y nunca había respondido
    Dado que Rocket Chat nunca respondió
    Cuando la sincronización intenta leer Rocket Chat 3 veces sin éxito
    Entonces se registra un fallo de Rocket Chat
    Y el estado de Rocket Chat es "sin-datos"
    Y las demás fuentes se procesan con normalidad
