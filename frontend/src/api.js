/** Cliente de la API. El token de Sesión viaja en la cabecera Authorization. */
export class ErrorSesion extends Error {}

export async function pedir(ruta, { token, metodo = 'GET', cuerpo, signal } = {}) {
  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    signal,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (respuesta.status === 401) throw new ErrorSesion('Tu sesión expiró. Vuelve a ingresar.');
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error ?? 'No se pudo conectar con el servidor.');
  return datos;
}

export const iniciarSesion = (rol) => pedir('/auth/login', { metodo: 'POST', cuerpo: { rol } });
export const cerrarSesion = (token) => pedir('/auth/logout', { metodo: 'POST', token });
