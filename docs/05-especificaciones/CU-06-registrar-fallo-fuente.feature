# language: es
# Responsable: Bryan. Requisitos: RNF-01. Extiende CU-05.
Característica: CU-06 Registrar fallo de fuente
  Como programador de tareas
  Quiero registrar una fuente que no pudo leerse después de tres intentos
  Para continuar la sincronización con los últimos datos exitosos disponibles en el almacén en memoria

  Escenario: Registrar el fallo y reutilizar los últimos datos buenos
    Dado que el almacén en memoria conserva datos de una lectura exitosa anterior de una fuente
    Y su conector devuelve un error en cada uno de los tres intentos de lectura
    Cuando CU-05 termina los reintentos de esa fuente
    Entonces el sistema registra la fuente, la fecha, tres intentos y el mensaje del último error
    Y recupera los últimos datos exitosos disponibles en el almacén en memoria para esa fuente
    Y permite que CU-05 continúe la sincronización con esos datos

  Escenario: Registrar el fallo cuando no hay datos anteriores
    Dado que el almacén en memoria no tiene datos de una lectura exitosa anterior para una fuente
    Y su conector devuelve un error en cada uno de los tres intentos de lectura
    Cuando CU-05 termina los reintentos de esa fuente
    Entonces el sistema registra el fallo con tres intentos y el mensaje del último error
    Y marca el estado individual de esa fuente como "sin-datos"
    Y permite que CU-05 continúe con una lista vacía para esa fuente
