# language: es
# Responsable: Bryan. Requisitos: RF-02 a RF-05, RNF-01, RNF-04. Incluye CU-07 y CU-08.
Característica: CU-05 Sincronizar fuentes
  Como Programador de tareas (cron)
  Quiero leer RedMine, GitLab, GLPI y Rocket Chat cada 15 minutos
  Para que el dashboard muestre la carga y el avance actualizados sin trabajo manual

  Escenario: Sincronización exitosa de las cuatro fuentes
    Dado que RedMine, GitLab, GLPI y Rocket Chat responden
    Cuando se cumple el intervalo de "*/15 * * * *"
    Entonces se leen las cuatro fuentes con su conector
    Y los datos se cruzan por código
    Y se recalculan la carga, el avance y las alertas
    Y el estado de la sincronización es "ok"

  Escenario: No se ejecutan dos sincronizaciones a la vez
    Dado que hay una sincronización en curso
    Cuando se cumple de nuevo el intervalo
    Entonces no se inicia otra sincronización
