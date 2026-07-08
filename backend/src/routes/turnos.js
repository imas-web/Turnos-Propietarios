import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { generarToken } from '../utils/token.js';
import { enviarCorreoConfirmacion } from '../utils/mailer.js';
import { ah } from '../utils/asyncHandler.js';

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

router.get(
  '/',
  ah(async (req, res) => {
    const { estado, propietario_id, desde, hasta } = req.query;
    const condiciones = [];
    const params = [];

    if (estado) {
      params.push(estado);
      condiciones.push(`t.estado = $${params.length}`);
    }
    if (propietario_id) {
      params.push(propietario_id);
      condiciones.push(`t.propietario_id = $${params.length}`);
    }
    if (desde) {
      params.push(desde);
      condiciones.push(`t.fecha >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      condiciones.push(`t.fecha <= $${params.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `${SELECT_TURNO} ${where} ORDER BY t.fecha ASC, t.hora_inicio ASC`,
      params
    );

    res.json(
      rows.map((t) => ({
        ...t,
        link_confirmacion: t.estado === 'pendiente' ? linkConfirmacion(t.token) : null,
      }))
    );
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    const turno = rows[0];
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
    res.json({ ...turno, link_confirmacion: linkConfirmacion(turno.token) });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const { propietario_id, titulo, descripcion, fecha, hora_inicio, hora_fin } =
      req.body || {};

    if (!propietario_id || !titulo || !fecha || !hora_inicio || !hora_fin) {
      return res.status(400).json({
        error: 'propietario_id, titulo, fecha, hora_inicio y hora_fin son requeridos',
      });
    }

    const { rows: propietarioRows } = await pool.query(
      'SELECT * FROM propietarios WHERE id = $1',
      [propietario_id]
    );
    const propietario = propietarioRows[0];
    if (!propietario) return res.status(404).json({ error: 'Propietario no encontrado' });

    const token = generarToken();
    const { rows: insertedRows } = await pool.query(
      `INSERT INTO turnos
        (propietario_id, titulo, descripcion, fecha, hora_inicio, hora_fin, token)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [propietario_id, titulo, descripcion || null, fecha, hora_inicio, hora_fin, token]
    );

    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [
      insertedRows[0].id,
    ]);
    const turno = rows[0];
    const link = linkConfirmacion(token);

    const envio = await enviarCorreoConfirmacion({
      to: propietario.email,
      nombre: propietario.nombre,
      turno,
      link,
    });

    res.status(201).json({ ...turno, link_confirmacion: link, correo_enviado: envio.enviado });
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const { rows: existingRows } = await pool.query('SELECT * FROM turnos WHERE id = $1', [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Turno no encontrado' });

    const { titulo, descripcion, fecha, hora_inicio, hora_fin } = req.body || {};
    await pool.query(
      `UPDATE turnos
       SET titulo = $1, descripcion = $2, fecha = $3, hora_inicio = $4, hora_fin = $5
       WHERE id = $6`,
      [
        titulo ?? existing.titulo,
        descripcion ?? existing.descripcion,
        fecha ?? existing.fecha,
        hora_inicio ?? existing.hora_inicio,
        hora_fin ?? existing.hora_fin,
        req.params.id,
      ]
    );

    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    res.json(rows[0]);
  })
);

router.post(
  '/:id/cancelar',
  ah(async (req, res) => {
    const { rows: existingRows } = await pool.query('SELECT * FROM turnos WHERE id = $1', [
      req.params.id,
    ]);
    if (!existingRows[0]) return res.status(404).json({ error: 'Turno no encontrado' });

    await pool.query(
      "UPDATE turnos SET estado = 'cancelado', respondido_en = NOW() WHERE id = $1",
      [req.params.id]
    );

    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    res.json(rows[0]);
  })
);

// Reenvia la confirmacion generando un nuevo token, util si el turno
// fue rechazado y se quiere reintentar, o si el link anterior se perdio.
router.post(
  '/:id/reenviar',
  ah(async (req, res) => {
    const { rows: existingRows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Turno no encontrado' });

    const token = generarToken();
    await pool.query(
      `UPDATE turnos
       SET token = $1, estado = 'pendiente', respondido_en = NULL, motivo_rechazo = NULL
       WHERE id = $2`,
      [token, req.params.id]
    );

    const link = linkConfirmacion(token);
    const envio = await enviarCorreoConfirmacion({
      to: existing.propietario_email,
      nombre: existing.propietario_nombre,
      turno: existing,
      link,
    });

    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    res.json({ ...rows[0], link_confirmacion: link, correo_enviado: envio.enviado });
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const { rows } = await pool.query('DELETE FROM turnos WHERE id = $1 RETURNING id', [
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Turno no encontrado' });
    res.status(204).send();
  })
);

export default router;
