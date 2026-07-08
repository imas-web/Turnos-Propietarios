import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

function formatearFecha(fechaStr) {
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  const texto = fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function agruparPorFecha(turnos) {
  const grupos = [];
  for (const turno of turnos) {
    let grupo = grupos.find((g) => g.fecha === turno.fecha);
    if (!grupo) {
      grupo = { fecha: turno.fecha, turnos: [] };
      grupos.push(grupo);
    }
    grupo.turnos.push(turno);
  }
  return grupos;
}

export default function ConfirmarTurnos() {
  const { token } = useAuth();
  const [turnos, setTurnos] = useState([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [motivoPorTurno, setMotivoPorTurno] = useState({});

  const cargarTurnos = async () => {
    setCargando(true);
    try {
      const data = await api.listarTurnos(token, {});
      setTurnos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTurnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmar = async (id) => {
    setError('');
    setMensaje('');
    try {
      await api.confirmarTurno(token, id);
      setMensaje('Turno confirmado.');
      await cargarTurnos();
    } catch (err) {
      setError(err.message);
    }
  };

  const rechazar = async (id) => {
    setError('');
    setMensaje('');
    try {
      await api.rechazarTurno(token, id, motivoPorTurno[id] || '');
      setMensaje('Turno rechazado.');
      await cargarTurnos();
    } catch (err) {
      setError(err.message);
    }
  };

  const pendientes = turnos.filter((t) => t.estado === 'pendiente');
  const grupos = agruparPorFecha(turnos);

  return (
    <div className="confirmar-layout">
      <aside className="confirmar-sidebar">
        <h2>Turnos a confirmar</h2>
        {error && <div className="error-banner">{error}</div>}
        {mensaje && <div className="success-banner">{mensaje}</div>}
        {pendientes.length === 0 ? (
          <p className="muted">No hay turnos pendientes.</p>
        ) : (
          pendientes.map((t) => (
            <div key={t.id} className="pendiente-item">
              <div className="agenda-hora">
                {formatearFecha(t.fecha)} · {t.hora_inicio}
              </div>
              <strong>{t.tutor}</strong>
              <div className="muted">{t.telefono}</div>
              <div className="muted">{t.direccion}</div>
              <div className="actions-row" style={{ marginTop: '0.5rem' }}>
                <button className="btn btn-success" onClick={() => confirmar(t.id)}>
                  Confirmar
                </button>
                <button className="btn btn-danger" onClick={() => rechazar(t.id)}>
                  Rechazar
                </button>
              </div>
              <input
                placeholder="Motivo de rechazo (opcional)"
                value={motivoPorTurno[t.id] || ''}
                onChange={(e) => setMotivoPorTurno({ ...motivoPorTurno, [t.id]: e.target.value })}
                style={{ marginTop: '0.4rem' }}
              />
            </div>
          ))
        )}
      </aside>

      <main className="container container-angosto confirmar-main">
        <div className="card">
          <h2>Todos los turnos</h2>
          {cargando ? (
            <p className="muted">Cargando...</p>
          ) : grupos.length === 0 ? (
            <p className="muted">No hay turnos para mostrar.</p>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.fecha} className="agenda-dia">
                <h3 className="agenda-fecha">{formatearFecha(grupo.fecha)}</h3>
                {grupo.turnos.map((t) => (
                  <div key={t.id} className="agenda-item">
                    <div className="agenda-hora">
                      {t.hora_inicio} - {t.hora_fin}
                    </div>
                    <div className="agenda-datos">
                      <strong>{t.tutor}</strong>
                      <div className="muted">{t.telefono}</div>
                      <div className="muted">{t.direccion}</div>
                      {t.estado === 'rechazado' && t.motivo_rechazo && (
                        <div className="muted">Motivo: {t.motivo_rechazo}</div>
                      )}
                    </div>
                    <span className={`badge badge-${t.estado}`}>{ETIQUETAS_ESTADO[t.estado]}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
