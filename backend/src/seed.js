import 'dotenv/config';
import { pool, ensureInit } from './db.js';
import { generarToken } from './utils/token.js';

await ensureInit();

const propietarios = [
  { nombre: 'Ana Garcia', email: 'ana.garcia@example.com', telefono: '11-5555-0001', unidad: '1A' },
  { nombre: 'Bruno Diaz', email: 'bruno.diaz@example.com', telefono: '11-5555-0002', unidad: '2B' },
  { nombre: 'Carla Nunez', email: 'carla.nunez@example.com', telefono: '11-5555-0003', unidad: '3C' },
];

const { rows } = await pool.query('SELECT COUNT(*) AS n FROM propietarios');
if (Number(rows[0].n) > 0) {
  console.log('Ya existen datos, no se vuelve a sembrar.');
  process.exit(0);
}

const ids = [];
for (const p of propietarios) {
  const { rows: inserted } = await pool.query(
    'INSERT INTO propietarios (nombre, email, telefono, unidad) VALUES ($1, $2, $3, $4) RETURNING id',
    [p.nombre, p.email, p.telefono, p.unidad]
  );
  ids.push(inserted[0].id);
}

const insertTurno = (propietarioId, titulo, descripcion, fecha, horaInicio, horaFin) =>
  pool.query(
    `INSERT INTO turnos (propietario_id, titulo, descripcion, fecha, hora_inicio, hora_fin, token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [propietarioId, titulo, descripcion, fecha, horaInicio, horaFin, generarToken()]
  );

await insertTurno(
  ids[0],
  'Limpieza de espacios comunes',
  'Turno mensual de limpieza del SUM y pasillos',
  '2026-07-15',
  '09:00',
  '11:00'
);

await insertTurno(
  ids[1],
  'Guardia de seguridad de fin de semana',
  'Recorrida y control de accesos',
  '2026-07-19',
  '20:00',
  '23:00'
);

await insertTurno(ids[2], 'Mantenimiento de jardin', null, '2026-07-22', '08:00', '10:00');

console.log('Datos de ejemplo cargados correctamente.');
await pool.end();
