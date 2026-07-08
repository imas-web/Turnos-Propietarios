import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente de confirmacion',
  confirmado: 'Confirmado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

export default function ConfirmarTurno() {
  const { token } = useParams();
  const [turno, setTurno] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const [motivo, setMotivo] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const data = await api.obtenerTurnoPorToken(token);
      setTurno(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const confirmar = async () => {
    setProcesando(true);
    setError('');
    try {
      const data = await api.confirmarTurno(token);
      setTurno(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const rechazar = async () => {
    setProcesando(true);
    setError('');
    try {
      const data = await api.rechazarTurno(token, motivo);
      setTurno(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) {
    return (
      <div className="confirmar-shell">
        <p className="muted">Cargando turno...</p>
      </div>
    );
  }

  if (error && !turno) {
    return (
      <div className="confirmar-shell">
        <div className="card confirmar-card">
          <h2>Link invalido</h2>
          <p className="error-banner">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="confirmar-shell">
      <div className="card confirmar-card">
        <h2>{turno.titulo}</h2>
        <p className="muted">
          {turno.propietario_nombre} · Unidad {turno.propietario_unidad}
        </p>
        <p>
          <strong>{turno.fecha}</strong> de {turno.hora_inicio} a {turno.hora_fin}
        </p>
        {turno.descripcion && <p className="muted">{turno.descripcion}</p>}

        <p>
          Estado actual:{' '}
          <span className={`badge badge-${turno.estado}`}>{ETIQUETAS_ESTADO[turno.estado]}</span>
        </p>

        {error && <div className="error-banner">{error}</div>}

        {turno.estado === 'pendiente' && !mostrarRechazo && (
          <div className="actions-row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
            <button className="btn btn-success" onClick={confirmar} disabled={procesando}>
              Confirmar asistencia
            </button>
            <button className="btn btn-danger" onClick={() => setMostrarRechazo(true)} disabled={procesando}>
              Rechazar
            </button>
          </div>
        )}

        {turno.estado === 'pendiente' && mostrarRechazo && (
          <div style={{ marginTop: '1rem', textAlign: 'left' }}>
            <div className="field">
              <label>Motivo (opcional)</label>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>
            <div className="actions-row" style={{ marginTop: '0.75rem' }}>
              <button className="btn btn-danger" onClick={rechazar} disabled={procesando}>
                Confirmar rechazo
              </button>
              <button className="btn" onClick={() => setMostrarRechazo(false)} disabled={procesando}>
                Volver
              </button>
            </div>
          </div>
        )}

        {turno.estado === 'confirmado' && (
          <p className="success-banner">Gracias, tu asistencia quedo confirmada.</p>
        )}
        {turno.estado === 'rechazado' && (
          <p className="error-banner">Registramos que no podras asistir a este turno.</p>
        )}
        {turno.estado === 'cancelado' && (
          <p className="muted">Este turno fue cancelado por la administracion.</p>
        )}
      </div>
    </div>
  );
}
