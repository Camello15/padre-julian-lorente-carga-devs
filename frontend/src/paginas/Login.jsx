import { useState } from 'react';
import { iniciarSesion } from '../api.js';
import { ROLES_PRUEBA } from '../utilidades/catalogo.js';

/** CU-01 Iniciar sesión con SSO (simulado en el prototipo). */
export default function Login({ onEntrar, aviso }) {
  const [rol, setRol] = useState('PMO');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function ingresar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      onEntrar(await iniciarSesion(rol));
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'No hay conexión con el servidor. Revisa que el backend esté encendido.' : e.message);
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <section className="login__marca" aria-labelledby="titulo-app">
        <img src="/icono.svg" alt="" width="44" height="44" />
        <h1 id="titulo-app">Carga de desarrolladores</h1>
        <p className="login__lema">
          Las peticiones de RedMine, GitLab, GLPI y Rocket Chat de cada desarrollador, reunidas en un solo tablero.
        </p>
        <ol className="login__etapas" aria-label="Etapas que sigue cada petición">
          {['Análisis', 'Desarrollo', 'Certificación', 'Despliegue', 'Estabilización'].map((etapa) => (
            <li key={etapa}>{etapa}</li>
          ))}
        </ol>
        <p className="login__pie">Área de Tecnologías de la Información</p>
      </section>

      <section className="login__panel" aria-labelledby="titulo-ingreso">
        <form className="login__formulario" onSubmit={ingresar}>
          <h2 id="titulo-ingreso">Ingresar</h2>
          <p className="texto-suave">Usa tu cuenta de la cooperativa. No necesitas otra contraseña.</p>

          {aviso && <p className="mensaje mensaje--info" role="status">{aviso}</p>}

          <fieldset className="selector-rol">
            <legend>Rol de prueba</legend>
            <p className="selector-rol__nota">Solo en el prototipo: elige con qué rol quieres entrar.</p>
            {ROLES_PRUEBA.map((opcion) => (
              <label key={opcion.clave} className="selector-rol__opcion">
                <input
                  type="radio"
                  name="rol"
                  value={opcion.clave}
                  checked={rol === opcion.clave}
                  onChange={() => setRol(opcion.clave)}
                />
                <span>
                  <strong>{opcion.nombre}</strong>
                  <span className="texto-suave">{opcion.descripcion}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}

          <button type="submit" className="boton boton--primario boton--ancho" disabled={enviando}>
            {enviando ? 'Conectando con el SSO…' : 'Ingresar con SSO de la cooperativa'}
          </button>
          <p className="login__simulado">SSO simulado para pruebas: no se envían credenciales.</p>
        </form>
      </section>
    </div>
  );
}
