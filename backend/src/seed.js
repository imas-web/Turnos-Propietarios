import 'dotenv/config';
import { db } from './db.js';
import { generarToken } from './utils/token.js';

const propietarios = [
  { nombre: 'Ana Garcia', email: 'ana.garcia@example.com', telefono: '11-5555-0001', unidad: '1A' },
  { nombre: 'Bruno Diaz', email: 'bruno.diaz@example.com', telefono: '11-5555-0002', unidad: '2B' },
  { nombre: 'Carla Nunez', email: 'carla.nunez@example.com', telefono: '11-5555-0003', unidad: '3C' },
];

const insertPropietario = db.prepare(
  'INSERT INTO propietarios (nombre, email, telefono, unidad) VALUES (?, ?, ?, ?)'
);
const insertTurno = db.prepare(
  `INSERT INTO turnos (propietario_id, titulo, descripcion, fecha, hora_inicio, hora_fin, token)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const yaHaySeed = db.prepare('SELECT COUNT(*) AS n FROM propietarios').get().n > 0;

if (yaHaySeed) {
  console.log('Ya existen datos, no se vuelve a sembrar.');
  process.exit(0);
}

const ids = propietarios.map((p) =>
  insertPropietario.run(p.nombre, p.email, p.telefono, p.unidad).lastInsertRowid
);

insertTurno.run(
  ids[0],
  'Limpieza de espacios comunes',
  'Turno mensual de limpieza del SUM y pasillos',
  '2026-07-15',
  '09:00',
  '11:00',
  generarToken()
);

insertTurno.run(
  ids[1],
  'Guardia de seguridad de fin de semana',
  'Recorrida y control de accesos',
  '2026-07-19',
  '20:00',
  '23:00',
  generarToken()
);

insertTurno.run(
  ids[2],
  'Mantenimiento de jardin',
  null,
  '2026-07-22',
  '08:00',
  '10:00',
  generarToken()
);

console.log('Datos de ejemplo cargados correctamente.');
