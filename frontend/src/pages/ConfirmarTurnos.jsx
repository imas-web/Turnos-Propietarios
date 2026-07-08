import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

export default function ConfirmarTurnos() {
  const { token } = useAuth();
  const [turnos, setTurnos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [motivoPorTurno, setMotivoPorTurno] = useState({});

  const cargarTurnos = async (estado = filtroEstado) => {
    setCargando(true);
    try {
      const data = await api.listarTurnos(token, { estado });
      setTurnos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTurnos('pendiente');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFiltroChange = async (e) => {
    const estado = e.target.value;
    setFiltroEstado(estado);
    await cargarTurnos(estado);
  };

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

  return (
    <div className="container">
      {error && <div className="error-banner">{error}</div>}
      {mensaje && <div className="success-banner">{mensaje}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Confirmar turnos</h2>
          <div className="field" style={{ minWidth: 180 }}>
            <select value={filtroEstado} onChange={onFiltroChange}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="rechazado">Rechazado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        {cargando ? (
          <p className="muted">Cargando...</p>
        ) : turnos.length === 0 ? (
          <p className="muted">No hay turnos para mostrar.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Turno</th>
                <th>Propietario</th>
                <th>Fecha / Horario</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.titulo}</strong>
                    {t.descripcion && <div className="muted">{t.descripcion}</div>}
                    {t.estado === 'rechazado' && t.motivo_rechazo && (
                      <div className="muted">Motivo: {t.motivo_rechazo}</div>
                    )}
                  </td>
                  <td>
                    {t.propietario_nombre}
                    <div className="muted">{t.propietario_unidad}</div>
                  </td>
                  <td>
                    {t.fecha}
                    <div className="muted">{t.hora_inicio} - {t.hora_fin}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${t.estado}`}>{ETIQUETAS_ESTADO[t.estado]}</span>
                  </td>
                  <td>
                    {t.estado === 'pendiente' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div className="actions-row">
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
                          onChange={(e) =>
                            setMotivoPorTurno({ ...motivoPorTurno, [t.id]: e.target.value })
                          }
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
