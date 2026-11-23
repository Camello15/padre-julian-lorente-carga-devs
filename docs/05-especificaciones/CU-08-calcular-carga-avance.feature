# language: es
# Responsable: Cristina. Requisitos: RF-08, RF-10.
Característica: CU-08 Calcular carga y avance
  Como sistema de centralización
  Quiero calcular la carga de peticiones abiertas y el avance estimado según su etapa por cada desarrollador
  Para mostrar indicadores actualizados de productividad y sobrecarga en el dashboard

  Escenario: Calcular carga y avance promedio de un desarrollador con peticiones abiertas
    Dado que existen peticiones sincronizadas en el almacén de datos
    Y el desarrollador "dev-01" tiene peticiones abiertas en etapas "Análisis" (10 %) y "Desarrollo" (40 %)
    Cuando se ejecuta el cálculo de carga y avance tras la sincronización
    Entonces el indicador de carga del desarrollador registra 2 peticiones abiertas clasificadas por tipo de trabajo
    Y su avance promedio estimado es 25 %
    Y se evalúa si la cantidad de peticiones abiertas supera el umbral configurado

  Escenario: Calcular carga de un desarrollador sin peticiones abiertas
    Dado que el desarrollador "dev-02" no tiene peticiones en estado "abierta"
    Cuando se ejecuta el cálculo de carga y avance
    Entonces su indicador de carga registra 0 peticiones abiertas
    Y su avance promedio estimado es 0 %
    Y el indicador de superación de umbral es falso
