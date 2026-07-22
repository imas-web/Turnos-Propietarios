import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const INTERVALO_REVISION_MS = 20000;

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
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const debounceBusqueda = useRef(null);
  const [avisos, setAvisos] = useState([]);
  const idsConocidosRef = useRef(null);

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

  const mostrarAviso = (turno) => {
    const texto = `${turno.paciente} — ${turno.creado_por_nombre} — ${formatearFecha(turno.fecha)} ${turno.hora_inicio}`;

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Nuevo turno pendiente de confirmar', { body: texto });
    }

    const avisoId = `${turno.id}-${Date.now()}`;
    setAvisos((prev) => [...prev, { avisoId, texto }]);
    setTimeout(() => {
      setAvisos((prev) => prev.filter((a) => a.avisoId !== avisoId));
    }, 8000);
  };

  // Sondea los turnos pendientes cada tantos segundos (mientras la pestana
  // esta abierta) para avisarle a Diagnotest apenas una extraccionista
  // carga un turno nuevo. La primera vez solo establece la base, sin avisar.
  const revisarNuevosPendientes = async () => {
    try {
      const data = await api.listarTurnos(token, { estado: 'pendiente' });
      if (idsConocidosRef.current) {
        for (const turno of data) {
          if (!idsConocidosRef.current.has(turno.id)) {
            mostrarAviso(turno);
          }
        }
      }
      idsConocidosRef.current = new Set(data.map((t) => t.id));
    } catch {
      // Fallo silencioso: es un chequeo de fondo, no debe interrumpir al usuario.
    }
  };

  useEffect(() => {
    cargarExtraccionistas();
    cargarTodo(fecha);

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    revisarNuevosPendientes();
    const intervalo = setInterval(revisarNuevosPendientes, INTERVALO_REVISION_MS);
    return () => clearInterval(intervalo);
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

  const buscar = async (texto) => {
    if (!texto.trim()) {
      setResultadosBusqueda([]);
      return;
    }
    setBuscando(true);
    try {
      const data = await api.listarTurnos(token, { q: texto.trim() });
      setResultadosBusqueda(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBuscando(false);
    }
  };

  const onBusquedaChange = (e) => {
    const texto = e.target.value;
    setBusqueda(texto);
    if (debounceBusqueda.current) clearTimeout(debounceBusqueda.current);
    debounceBusqueda.current = setTimeout(() => buscar(texto), 300);
  };

  const confirmar = async (id) => {
    setError('');
    setMensaje('');
    const numero_dt = (dtPorTurno[id] || '').trim();
    if (!numero_dt) {
      setError('Ingresa el numero de protocolo para poder confirmar el turno.');
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

  // Como cada extraccionista puede elegir cualquier horario (no solo horas
  // fijas), las filas de la grilla son los horarios que realmente se usaron
  // ese dia, no una lista de horarios predefinidos.
  const slotsDelDia = [...new Set(turnosVisiblesGrilla.map((t) => t.hora_inicio))].sort();

  const celda = (extraccionistaId, slot) =>
    turnosVisiblesGrilla.find(
      (t) => t.creado_por === extraccionistaId && t.hora_inicio === slot
    );

  return (
    <div className="confirmar-layout">
      {avisos.length > 0 && (
        <div className="toast-container">
          {avisos.map((a) => (
            <div key={a.avisoId} className="toast">
              <strong>Nuevo turno pendiente</strong>
              <div>{a.texto}</div>
            </div>
          ))}
        </div>
      )}

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
                  <strong>{t.paciente}</strong>
                  <div className="muted">Tutor: {t.tutor}</div>
                  <div className="muted">{t.creado_por_nombre}</div>
                  <div className="muted">{t.telefono}</div>
                  <div className="muted">{t.direccion}</div>
                  <div className="muted">{t.email}</div>
                  <input
                    placeholder="Nº de protocolo (para confirmar)"
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
          <h2 style={{ marginTop: 0 }}>Buscar turno</h2>
          <input
            type="search"
            placeholder="Buscar por paciente, tutor o email..."
            value={busqueda}
            onChange={onBusquedaChange}
            style={{ width: '100%' }}
          />

          {busqueda.trim() &&
            (buscando ? (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                Buscando...
              </p>
            ) : resultadosBusqueda.length === 0 ? (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                No se encontraron turnos.
              </p>
            ) : (
              <div style={{ marginTop: '0.75rem' }}>
                {resultadosBusqueda.map((t) => (
                  <div key={t.id} className="agenda-item">
                    <div className="agenda-hora">
                      {formatearFecha(t.fecha)} · {t.hora_inicio}
                    </div>
                    <div className="agenda-datos">
                      <strong>{t.paciente}</strong>
                      <div className="muted">Tutor: {t.tutor}</div>
                      <div className="muted">{t.creado_por_nombre}</div>
                      <div className="muted">{t.email}</div>
                    </div>
                    <span className={`badge badge-${t.estado}`}>{ETIQUETAS_ESTADO[t.estado]}</span>
                  </div>
                ))}
              </div>
            ))}
        </div>

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
          ) : slotsDelDia.length === 0 ? (
            <p className="muted">No hay turnos para este dia.</p>
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
                  {slotsDelDia.map((slot) => (
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
                            {turno && (
                              <span title={`Tutor: ${turno.tutor}`}>{turno.paciente}</span>
                            )}
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
