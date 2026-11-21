import { useEffect, useState } from 'react';
import { pedir } from '../api.js';

/** CU-10 Configurar umbral y CU-11 Revisar registros no reconocidos. */
export default function PanelAdministracionTI({ token, umbralActual, onUmbralActualizado }) {
  const [maxPeticiones, setMaxPeticiones] = useState(umbralActual?.maxPeticiones ?? 6);
  const [guardandoUmbral, setGuardandoUmbral] = useState(false);
  const [mensajeUmbral, setMensajeUmbral] = useState('');
  const [errorUmbral, setErrorUmbral] = useState('');

  const [registros, setRegistros] = useState([]);
  const [cargandoRegistros, setCargandoRegistros] = useState(true);
  const [codigosAsignados, setCodigosAsignados] = useState({});

  useEffect(() => {
    const control = new AbortController();
    pedir('/registros-no-reconocidos', { token, signal: control.signal })
      .then((res) => {
        setRegistros(res.registros ?? []);
        setCargandoRegistros(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setCargandoRegistros(false);
      });
    return () => control.abort();
  }, [token]);

  const guardarUmbral = async (e) => {
    e.preventDefault();
    setErrorUmbral('');
    setMensajeUmbral('');
    setGuardandoUmbral(true);
    try {
      const res = await pedir('/umbral', {
        method: 'PUT',
        token,
        cuerpo: { maxPeticiones: Number(maxPeticiones) },
      });
      setMensajeUmbral(`Umbral actualizado a ${res.umbral.maxPeticiones} peticiones.`);
      onUmbralActualizado(res.umbral, res.alertas, res.indicadores);
    } catch (err) {
      setErrorUmbral(err.message);
    } finally {
      setGuardandoUmbral(false);
    }
  };

  const marcarRevisado = async (id) => {
    const peticionCodigo = codigosAsignados[id] ?? '';
    const res = await pedir(`/registros-no-reconocidos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      cuerpo: { peticionCodigo },
    });
    setRegistros((prev) => prev.filter((r) => String(r.id) !== String(res.registro.id)));
  };

  return (
    <section className="panel" aria-labelledby="titulo-admin-ti">
      <div className="panel__cabecera">
        <h2 id="titulo-admin-ti">Administración TI (Umbral y registros no reconocidos)</h2>
        <p className="texto-suave">Configura el límite de alertas y revisa códigos sin coincidencia en RedMine.</p>
      </div>

      <form
        onSubmit={guardarUmbral}
        className="admin-umbral"
        style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}
      >
        <label htmlFor="input-umbral">
          <strong>Umbral máximo de peticiones abiertas:</strong>
        </label>
        <input
          id="input-umbral"
          type="number"
          min="1"
          max="100"
          value={maxPeticiones}
          onChange={(e) => setMaxPeticiones(e.target.value)}
          style={{ width: '5rem', padding: '0.35rem 0.5rem' }}
          required
        />
        <button type="submit" className="boton boton--primario" disabled={guardandoUmbral}>
          {guardandoUmbral ? 'Guardando…' : 'Guardar umbral'}
        </button>
        {mensajeUmbral && (
          <span className="texto-suave" role="status">
            {mensajeUmbral}
          </span>
        )}
        {errorUmbral && (
          <span className="mensaje mensaje--error" role="alert">
            {errorUmbral}
          </span>
        )}
      </form>

      <div>
        <h3>Registros no reconocidos pendientes ({registros.length})</h3>
        {cargandoRegistros ? (
          <p className="texto-suave">Cargando registros…</p>
        ) : registros.length === 0 ? (
          <p className="texto-suave">No hay registros pendientes de revisión.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
            {registros.map((reg) => (
              <li
                key={reg.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.65rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong>[{reg.fuente}]</strong> <code>{reg.codigoOriginal}</code> —{' '}
                  <span className="texto-suave">{reg.motivo ?? 'Sin coincidencia'}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Código petición (opcional)"
                    value={codigosAsignados[reg.id] ?? ''}
                    onChange={(e) => setCodigosAsignados((prev) => ({ ...prev, [reg.id]: e.target.value }))}
                    style={{ padding: '0.3rem 0.5rem' }}
                  />
                  <button type="button" className="boton boton--secundario" onClick={() => marcarRevisado(reg.id)}>
                    Marcar revisado
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
