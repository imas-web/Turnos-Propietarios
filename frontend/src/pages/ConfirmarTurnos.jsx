import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const MINUTOS_INICIO_LABORAL = 8 * 60;
const MINUTOS_FIN_LABORAL = 20 * 60;
const PASO_MINUTOS = 15;

function generarSlots() {
  const slots = [];
  for (let min = MINUTOS_INICIO_LABORAL; min < MINUTOS_FIN_LABORAL; min += PASO_MINUTOS) {
    const h = String(Math.floor(min / 60)).padStart(2, '0');
    const m = String(min % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

const SLOTS = generarSlots();

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

export default function ConfirmarTurnos() {
  const { token } = useAuth();
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [extraccionistas, setExtraccionistas] = useState([]);
  const [turnosDia, setTurnosDia] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [mostrarPendientes, setMostrarPendientes] = useState(false);
  const [filtroFechaPendientes, setFiltroFechaPendientes] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [motivoPorTurno, setMotivoPorTurno] = useState({});
  const [dtPorTurno, setDtPorTurno] = useState({});

  const cargarExtraccionistas = async () => {
    try {
      const data = await api.obtenerExtraccionistas(token);
      setExtraccionistas(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const cargarTurnosDia = async (f = fecha) => {
    setCargando(true);
    try {
      const data = await api.listarTurnos(token, { desde: f, hasta: f });
      setTurnosDia(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const cargarPendientes = async (fechaFiltro = filtroFechaPendientes) => {
    try {
      const params = { estado: 'pendiente' };
      if (fechaFiltro) {
        params.desde = fechaFiltro;
        params.hasta = fechaFiltro;
      }
      const data = await api.listarTurnos(token, params);
      setPendientes(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const cargarTodo = async (f = fecha) => {
    await Promise.all([cargarTurnosDia(f), cargarPendientes()]);
  };

  useEffect(() => {
    cargarExtraccionistas();
    cargarTodo(fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFechaChange = async (e) => {
    const f = e.target.value;
    setFecha(f);
    await cargarTurnosDia(f);
  };

  const onFiltroFechaPendientesChange = async (e) => {
    const f = e.target.value;
    setFiltroFechaPendientes(f);
    await cargarPendientes(f);
  };

  const limpiarFiltroFechaPendientes = async () => {
    setFiltroFechaPendientes('');
    await cargarPendientes('');
  };

  const confirmar = async (id) => {
    setError('');
    setMensaje('');
    const numero_dt = (dtPorTurno[id] || '').trim();
    if (!numero_dt) {
      setError('Ingresa el numero de DT para poder confirmar el turno.');
      return;
    }
    try {
      await api.confirmarTurno(token, id, numero_dt);
      setMensaje('Turno confirmado.');
      await cargarTodo();
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
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    }
  };

  const turnosVisiblesGrilla = turnosDia.filter(
    (t) => t.estado === 'pendiente' || t.estado === 'confirmado'
  );

  const celda = (extraccionistaId, slot) =>
    turnosVisiblesGrilla.find(
      (t) => t.creado_por === extraccionistaId && t.hora_inicio === slot
    );

  return (
    <div className="confirmar-layout">
      <aside className="confirmar-sidebar">
        <button
          className="btn btn-primary btn-ancho"
          style={{ marginBottom: mostrarPendientes ? '1rem' : 0 }}
          onClick={() => setMostrarPendientes((v) => !v)}
        >
          Turnos pendientes de confirmacion ({pendientes.length})
        </button>

        {mostrarPendientes && (
          <>
            <div className="actions-row" style={{ marginBottom: '0.85rem' }}>
              <input
                type="date"
                value={filtroFechaPendientes}
                onChange={onFiltroFechaPendientesChange}
              />
              {filtroFechaPendientes && (
                <button className="btn" type="button" onClick={limpiarFiltroFechaPendientes}>
                  Ver todos los dias
                </button>
              )}
            </div>
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
                  <div className="muted">{t.creado_por_nombre}</div>
                  <div className="muted">{t.telefono}</div>
                  <div className="muted">{t.direccion}</div>
                  <input
                    placeholder="Numero de DT (requerido para confirmar)"
                    value={dtPorTurno[t.id] || ''}
                    onChange={(e) => setDtPorTurno({ ...dtPorTurno, [t.id]: e.target.value })}
                    style={{ marginTop: '0.5rem' }}
                  />
                  <input
                    placeholder="Motivo de rechazo (opcional)"
                    value={motivoPorTurno[t.id] || ''}
                    onChange={(e) =>
                      setMotivoPorTurno({ ...motivoPorTurno, [t.id]: e.target.value })
                    }
                    style={{ marginTop: '0.4rem' }}
                  />
                  <div className="actions-row" style={{ marginTop: '0.5rem' }}>
                    <button className="btn btn-success" onClick={() => confirmar(t.id)}>
                      Confirmar
                    </button>
                    <button className="btn btn-danger" onClick={() => rechazar(t.id)}>
                      Rechazar
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </aside>

      <main className="container confirmar-main">
        <div className="card">
          <div className="agenda-header">
            <h2 style={{ margin: 0 }}>{formatearFecha(fecha)}</h2>
            <input type="date" value={fecha} onChange={onFechaChange} />
          </div>

          <div className="leyenda-grilla">
            <span className="leyenda-item">
              <span className="leyenda-color leyenda-pendiente" /> Sin confirmar
            </span>
            <span className="leyenda-item">
              <span className="leyenda-color leyenda-confirmado" /> Confirmado
            </span>
          </div>

          {cargando ? (
            <p className="muted">Cargando...</p>
          ) : extraccionistas.length === 0 ? (
            <p className="muted">No hay extraccionistas cargadas.</p>
          ) : (
            <div className="grilla-scroll">
              <table className="grilla">
                <thead>
                  <tr>
                    <th>Hora</th>
                    {extraccionistas.map((ex) => (
                      <th key={ex.id}>{ex.nombre}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map((slot) => (
                    <tr key={slot}>
                      <td className="grilla-hora">{slot}</td>
                      {extraccionistas.map((ex) => {
                        const turno = celda(ex.id, slot);
                        return (
                          <td
                            key={ex.id}
                            className={
                              turno
                                ? `grilla-celda grilla-${turno.estado}`
                                : 'grilla-celda'
                            }
                          >
                            {turno && <span title={turno.tutor}>{turno.tutor}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
