# language: es
# Responsable: Bryan. Requisitos: RF-02 a RF-05, RF-06 a RF-10, RF-12, RNF-01, RNF-04. Incluye CU-07 y CU-08.
Característica: CU-05 Sincronizar fuentes
  Como Programador de tareas (cron)
  Quiero leer periódicamente RedMine, GitLab, GLPI y Rocket Chat
  Para actualizar la información de carga y avance disponible para consulta

  Escenario: Sincronizar las fuentes y actualizar los datos
    Dado que los conectores de RedMine, GitLab, GLPI y Rocket Chat están registrados
    Y las cuatro fuentes responden exitosamente
    Y no hay otra sincronización en ejecución
    Cuando el programador dispara la sincronización
    Entonces el sistema lee RedMine, GitLab, GLPI y Rocket Chat en paralelo
    Y cruza las Peticiones de RedMine con GLPI y GitLab por código (CU-07)
    Y obtiene de Rocket Chat las notificaciones que mencionan códigos de Peticiones reconocidas
    Y calcula la carga y el avance (CU-08)
    Y guarda los datos unificados y el estado de sincronización
    Y el estado global de la ejecución es "ok"

  Escenario: Continuar cuando una fuente falla y hay datos anteriores
    Dado que una fuente falla después de tres intentos de lectura
    Y existen datos buenos anteriores para esa fuente
    Cuando continúa la sincronización
    Entonces el sistema registra el fallo de la fuente (CU-06)
    Y usa los últimos datos buenos disponibles de esa fuente
    Y procesa los datos de las demás fuentes
    Y guarda el estado de sincronización como "parcial"

  Escenario: Continuar con una fuente sin datos anteriores
    Dado que una fuente falla después de tres intentos de lectura
    Y no existen datos exitosos anteriores para esa fuente en el almacén en memoria
    Cuando continúa la sincronización
    Entonces el sistema registra el fallo de la fuente (CU-06)
    Y utiliza una lista vacía para esa fuente
    Y procesa los datos de las demás fuentes
    Y guarda el estado global como "parcial"

  Escenario: Marcar la sincronización como fallida cuando fallan todas las fuentes
    Dado que RedMine, GitLab, GLPI y Rocket Chat fallan después de tres intentos de lectura
    Cuando continúa la sincronización
    Entonces el sistema usa los últimos datos exitosos disponibles en memoria o una lista vacía para cada fuente
    Y guarda el estado global como "fallida"

  Escenario: No iniciar otra sincronización mientras hay una en ejecución
    Dado que hay una sincronización en ejecución
    Cuando el programador dispara otra sincronización
    Entonces el sistema no inicia una segunda ejecución
    Y devuelve "null"

  Escenario: Mantener el estado inicial antes de la primera sincronización
    Dado que todavía no se ha ejecutado ninguna sincronización
    Entonces el estado global es "pendiente"
