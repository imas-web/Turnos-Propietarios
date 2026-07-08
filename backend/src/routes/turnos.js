import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { generarToken } from '../utils/token.js';
import { enviarCorreoConfirmacion } from '../utils/mailer.js';

const router = Router();

const SELECT_TURNO = `
  SELECT t.*, p.nombre AS propietario_nombre, p.email AS propietario_email,
         p.unidad AS propietario_unidad
  FROM turnos t
  JOIN propietarios p ON p.id = t.propietario_id
`;

function linkConfirmacion(token) {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}/confirmar/${token}`;
}

router.use(requireAuth);

router.get('/', (req, res) => {
  const { estado, propietario_id, desde, hasta } = req.query;
  const condiciones = [];
  const params = [];

  if (estado) {
    condiciones.push('t.estado = ?');
    params.push(estado);
  }
  if (propietario_id) {
    condiciones.push('t.propietario_id = ?');
    params.push(propietario_id);
  }
  if (desde) {
    condiciones.push('t.fecha >= ?');
    params.push(desde);
  }
  if (hasta) {
    condiciones.push('t.fecha <= ?');
    params.push(hasta);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const turnos = db
    .prepare(`${SELECT_TURNO} ${where} ORDER BY t.fecha ASC, t.hora_inicio ASC`)
    .all(...params);

  res.json(
    turnos.map((t) => ({
      ...t,
      link_confirmacion: t.estado === 'pendiente' ? linkConfirmacion(t.token) : null,
    }))
  );
});

router.get('/:id', (req, res) => {
  const turno = db.prepare(`${SELECT_TURNO} WHERE t.id = ?`).get(req.params.id);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
  res.json({ ...turno, link_confirmacion: linkConfirmacion(turno.token) });
});

router.post('/', async (req, res) => {
  const { propietario_id, titulo, descripcion, fecha, hora_inicio, hora_fin } =
    req.body || {};

  if (!propietario_id || !titulo || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({
      error: 'propietario_id, titulo, fecha, hora_inicio y hora_fin son requeridos',
    });
  }

  const propietario = db
    .prepare('SELECT * FROM propietarios WHERE id = ?')
    .get(propietario_id);
  if (!propietario) return res.status(404).json({ error: 'Propietario no encontrado' });

  const token = generarToken();
  const info = db
    .prepare(
      `INSERT INTO turnos
        (propietario_id, titulo, descripcion, fecha, hora_inicio, hora_fin, token)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(propietario_id, titulo, descripcion || null, fecha, hora_inicio, hora_fin, token);

  const turno = db.prepare(`${SELECT_TURNO} WHERE t.id = ?`).get(info.lastInsertRowid);
  const link = linkConfirmacion(token);

  const envio = await enviarCorreoConfirmacion({
    to: propietario.email,
    nombre: propietario.nombre,
    turno,
    link,
  });

  res.status(201).json({ ...turno, link_confirmacion: link, correo_enviado: envio.enviado });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM turnos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Turno no encontrado' });

  const { titulo, descripcion, fecha, hora_inicio, hora_fin } = req.body || {};
  db.prepare(
    `UPDATE turnos
     SET titulo = ?, descripcion = ?, fecha = ?, hora_inicio = ?, hora_fin = ?
     WHERE id = ?`
  ).run(
    titulo ?? existing.titulo,
    descripcion ?? existing.descripcion,
    fecha ?? existing.fecha,
    hora_inicio ?? existing.hora_inicio,
    hora_fin ?? existing.hora_fin,
    req.params.id
  );

  const turno = db.prepare(`${SELECT_TURNO} WHERE t.id = ?`).get(req.params.id);
  res.json(turno);
});

router.post('/:id/cancelar', (req, res) => {
  const existing = db.prepare('SELECT * FROM turnos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Turno no encontrado' });

  db.prepare(
    "UPDATE turnos SET estado = 'cancelado', respondido_en = datetime('now') WHERE id = ?"
  ).run(req.params.id);

  const turno = db.prepare(`${SELECT_TURNO} WHERE t.id = ?`).get(req.params.id);
  res.json(turno);
});

// Reenvia la confirmacion generando un nuevo token, util si el turno
// fue rechazado y se quiere reintentar, o si el link anterior se perdio.
router.post('/:id/reenviar', async (req, res) => {
  const existing = db.prepare(`${SELECT_TURNO} WHERE t.id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Turno no encontrado' });

  const token = generarToken();
  db.prepare(
    "UPDATE turnos SET token = ?, estado = 'pendiente', respondido_en = NULL, motivo_rechazo = NULL WHERE id = ?"
  ).run(token, req.params.id);

  const link = linkConfirmacion(token);
  const envio = await enviarCorreoConfirmacion({
    to: existing.propietario_email,
    nombre: existing.propietario_nombre,
    turno: existing,
    link,
  });

  const turno = db.prepare(`${SELECT_TURNO} WHERE t.id = ?`).get(req.params.id);
  res.json({ ...turno, link_confirmacion: link, correo_enviado: envio.enviado });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM turnos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Turno no encontrado' });

  db.prepare('DELETE FROM turnos WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
