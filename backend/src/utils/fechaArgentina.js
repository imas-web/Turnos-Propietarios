const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

export function fechaYHoraActualEnArgentina() {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const partes = Object.fromEntries(
    formateador.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

export function sumarDias(fechaStr, dias) {
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}
