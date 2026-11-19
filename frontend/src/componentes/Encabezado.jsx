export default function Encabezado({ usuario, onSalir }) {
  return (
    <header className="encabezado">
      <div className="encabezado__marca">
        <img src="/icono.svg" alt="" width="28" height="28" />
        <span>Carga de desarrolladores</span>
      </div>
      <div className="encabezado__usuario">
        <span className="encabezado__nombre">
          {usuario.nombre}
          <span className="etiqueta-rol">{usuario.rol.nombre}</span>
        </span>
        <button type="button" className="boton boton--discreto" onClick={() => onSalir()}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
