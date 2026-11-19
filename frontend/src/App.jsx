import { useCallback, useState } from 'react';
import { cerrarSesion } from './api.js';
import Dashboard from './paginas/Dashboard.jsx';
import Login from './paginas/Login.jsx';

const CLAVE = 'carga-devs:sesion';

function leerSesion() {
  try {
    const sesion = JSON.parse(sessionStorage.getItem(CLAVE));
    return sesion && new Date(sesion.expira) > new Date() ? sesion : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [sesion, setSesion] = useState(leerSesion);
  const [aviso, setAviso] = useState('');

  const entrar = useCallback((nueva) => {
    try { sessionStorage.setItem(CLAVE, JSON.stringify(nueva)); } catch { /* sin almacenamiento */ }
    setAviso('');
    setSesion(nueva);
  }, []);

  const salir = useCallback(async (motivo = '') => {
    if (!motivo && sesion) await cerrarSesion(sesion.token).catch(() => {});
    try { sessionStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
    setAviso(motivo);
    setSesion(null);
  }, [sesion]);

  return sesion
    ? <Dashboard sesion={sesion} onSalir={salir} />
    : <Login onEntrar={entrar} aviso={aviso} />;
}
