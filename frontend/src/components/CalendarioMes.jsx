const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatoFecha(anio, mes, dia) {
  const m = String(mes + 1).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return `${anio}-${m}-${d}`;
}

export default function CalendarioMes({ anio, mes, turnos, fechaSeleccionada, onSeleccionarDia, onCambiarMes }) {
  const hoy = new Date();
  const hoyStr = formatoFecha(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const conteoPorDia = {};
  for (const t of turnos) {
    if (!conteoPorDia[t.fecha]) {
      conteoPorDia[t.fecha] = { pendiente: 0, confirmado: 0, rechazado: 0 };
    }
    if (conteoPorDia[t.fecha][t.estado] !== undefined) {
      conteoPorDia[t.fecha][t.estado] += 1;
    }
  }

  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const inicioSemana = new Date(anio, mes, 1).getDay();

  const celdas = [];
  for (let i = 0; i < inicioSemana; i++) celdas.push(null);
  for (let dia = 1; dia <= diasEnMes; dia++) celdas.push(dia);

  const irMesAnterior = () => {
    if (mes === 0) onCambiarMes(anio - 1, 11);
    else onCambiarMes(anio, mes - 1);
  };

  const irMesSiguiente = () => {
    if (mes === 11) onCambiarMes(anio + 1, 0);
    else onCambiarMes(anio, mes + 1);
  };

  return (
    <div className="calendario-mes">
      <div className="calendario-header">
        <button className="btn" type="button" onClick={irMesAnterior} aria-label="Mes anterior">
          ‹
        </button>
        <strong>
          {NOMBRES_MES[mes]} {anio}
        </strong>
        <button className="btn" type="button" onClick={irMesSiguiente} aria-label="Mes siguiente">
          ›
        </button>
      </div>

      <div className="calendario-grid calendario-dias-semana">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="calendario-dia-semana">
            {d}
          </div>
        ))}
      </div>

      <div className="calendario-grid">
        {celdas.map((dia, i) => {
          if (dia === null) {
            return <div key={`vacio-${i}`} className="calendario-celda calendario-celda-vacia" />;
          }
          const fechaStr = formatoFecha(anio, mes, dia);
          const conteo = conteoPorDia[fechaStr];
          const clases = ['calendario-celda'];
          if (fechaStr === hoyStr) clases.push('calendario-celda-hoy');
          if (fechaStr === fechaSeleccionada) clases.push('calendario-celda-seleccionada');

          return (
            <button
              key={fechaStr}
              type="button"
              className={clases.join(' ')}
              onClick={() => onSeleccionarDia(fechaStr)}
            >
              <span className="calendario-numero">{dia}</span>
              {conteo && (
                <span className="calendario-badges">
                  {conteo.pendiente > 0 && (
                    <span className="badge badge-pendiente">{conteo.pendiente}</span>
                  )}
                  {conteo.confirmado > 0 && (
                    <span className="badge badge-confirmado">{conteo.confirmado}</span>
                  )}
                  {conteo.rechazado > 0 && (
                    <span className="badge badge-rechazado">{conteo.rechazado}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
