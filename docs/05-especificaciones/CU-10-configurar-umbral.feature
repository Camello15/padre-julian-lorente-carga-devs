# language: es
# Responsable: Cristina. Requisitos: RF-12.
Característica: CU-10 Configurar umbral
  Como Administrador TI
  Quiero configurar el número máximo de peticiones abiertas permitidas por desarrollador
  Para ajustar el criterio de generación de alertas según la capacidad operativa del equipo

  Escenario: Actualizar el umbral máximo de peticiones abiertas con un valor válido
    Dado que el usuario ha iniciado sesión con el rol Administrador TI
    Cuando establece el nuevo umbral máximo en 6 peticiones abiertas
    Entonces el sistema guarda el nuevo umbral
    Y recalcula el estado de sobrecarga y alertas de los desarrolladores con el nuevo límite

  Escenario: Rechazar un valor de umbral inválido
    Dado que el usuario ha iniciado sesión con el rol Administrador TI
    Cuando intenta configurar el umbral máximo con un valor menor o igual a 0
    Entonces el sistema rechaza la operación con un mensaje de validación
    Y conserva el umbral anterior sin cambios

  Escenario: Rechazar el cambio de umbral a un rol distinto de Administrador TI
    Dado que el usuario ha iniciado sesión con el rol Administrativo
    Cuando intenta configurar el umbral máximo en 4 peticiones abiertas
    Entonces el sistema rechaza la operación por falta de permisos
    Y conserva el umbral anterior sin cambios
