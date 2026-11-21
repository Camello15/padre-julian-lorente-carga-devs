> Responsable: **Cristina**. Módulo: Datos y alertas. Escenarios: [`CU-10-configurar-umbral.feature`](05-especificaciones/CU-10-configurar-umbral.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-10 |
| **Nombre** | Configurar umbral |
| **Actores** | Administrador TI |
| **Descripción** | Permite al Administrador TI modificar el límite máximo de peticiones abiertas por desarrollador antes de disparar alertas de sobrecarga. |
| **Precondiciones** | El usuario ha iniciado sesión (CU-01) y posee rol con permiso de administración (`ADMINISTRATIVO` / `configurar:umbral`). |
| **Flujo principal** | 1. El Administrador TI envía el nuevo valor entero positivo para `maxPeticiones`.<br>2. El sistema valida que el valor sea un entero mayor o igual a `1`.<br>3. Actualiza el umbral vigente registrando quién realizó el cambio y la fecha.<br>4. Recalcula el indicador `superaUmbral` y las alertas vigentes con el nuevo límite. |
| **Flujos alternativos** | Ninguno. |
| **Excepciones** | **EX-01 (Valor inválido):** Si `maxPeticiones` no es un entero positivo (`<= 0` o no numérico), el sistema devuelve HTTP `400` y conserva el umbral previo.<br>**EX-02 (Sin permisos):** Si un usuario sin permiso administrativo intenta modificar el umbral, el sistema devuelve HTTP `403`. |
| **Postcondiciones** | El nuevo umbral queda activo para las consultas inmediatas y futuras sincronizaciones. |
| **Requisitos relacionados** | RF-12, RNF-02 |