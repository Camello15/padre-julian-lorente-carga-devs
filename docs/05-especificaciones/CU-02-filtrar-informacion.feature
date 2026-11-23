# language: es
# Responsable: Camilo. Requisitos: RF-11. Incluye CU-01.
Característica: CU-02 Filtrar información
  Como usuario con rol PMO, Técnico, Administrativo o Administrador TI
  Quiero filtrar por desarrollador, tipo de trabajo, proyecto, módulo del core y fechas
  Para ver solo las peticiones que me interesan

  Escenario: Filtrar por tipo de trabajo
    Dado que inicié sesión con el rol "PMO"
    Y estoy en el dashboard
    Cuando elijo el tipo de trabajo "Incidente"
    Entonces la tabla muestra solo peticiones de tipo "Incidente"
    Y el gráfico de carga se actualiza con los mismos filtros

  Escenario: El Técnico solo ve su propia carga
    Dado que inicié sesión con el rol "Técnico"
    Cuando abro el panel de filtros
    Entonces el filtro "Desarrollador" está fijo en mi nombre
    Y no puedo ver peticiones de otros desarrolladores
