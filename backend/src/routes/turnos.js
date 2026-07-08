import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';

const router = Router();

const SELECT_TURNO = `
  SELECT t.*, p.nombre AS propietario_nombre, p.email AS propietario_email,
         p.unidad AS propietario_unidad
  FROM turnos t
  JOIN propietarios p ON p.id = t.propietario_id
`;

router.use(requireAuth);

router.get(
  '/',
  ah(async (req, res) => {
    const { estado, propietario_id, desde, hasta } = req.query;
    const condiciones = [];
    const params = [];

    if (req.usuario.rol === 'extraccionista') {
      params.push(req.usuario.sub);
      condiciones.push(`t.creado_por = $${params.length}`);
    }
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

    res.json(rows);
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    const turno = rows[0];
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
    if (req.usuario.rol === 'extraccionista' && turno.creado_por !== req.usuario.sub) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    res.json(turno);
  })
);

router.post(
  '/',
  requireRol('extraccionista'),
  ah(async (req, res) => {
    const { propietario_id, titulo, descripcion, fecha, hora_inicio, hora_fin } =
      req.body || {};

    if (!propietario_id || !titulo || !fecha || !hora_inicio || !hora_fin) {
      return res.status(400).json({
        error: 'propietario_id, titulo, fecha, hora_inicio y hora_fin son requeridos',
      });
    }

    const { rows: propietarioRows } = await pool.query(
      'SELECT * FROM propietarios WHERE id = $1 AND creado_por = $2',
      [propietario_id, req.usuario.sub]
    );
    if (!propietarioRows[0]) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    const { rows: insertedRows } = await pool.query(
      `INSERT INTO turnos
        (propietario_id, titulo, descripcion, fecha, hora_inicio, hora_fin, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        propietario_id,
        titulo,
        descripcion || null,
        fecha,
        hora_inicio,
        hora_fin,
        req.usuario.sub,
      ]
    );

    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [
      insertedRows[0].id,
    ]);
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  requireRol('extraccionista'),
  ah(async (req, res) => {
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM turnos WHERE id = $1 AND creado_por = $2',
      [req.params.id, req.usuario.sub]
    );
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
  requireRol('extraccionista'),
  ah(async (req, res) => {
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM turnos WHERE id = $1 AND creado_por = $2',
      [req.params.id, req.usuario.sub]
    );
    if (!existingRows[0]) return res.status(404).json({ error: 'Turno no encontrado' });

    await pool.query(
      "UPDATE turnos SET estado = 'cancelado', respondido_en = NOW() WHERE id = $1",
      [req.params.id]
    );

    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  requireRol('extraccionista'),
  ah(async (req, res) => {
    const { rows } = await pool.query(
      'DELETE FROM turnos WHERE id = $1 AND creado_por = $2 RETURNING id',
      [req.params.id, req.usuario.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Turno no encontrado' });
    res.status(204).send();
  })
);

// Confirmacion/rechazo interno: solo el rol "diagnotest"
// puede resolver turnos pendientes, sin importar quien los haya cargado.
router.post(
  '/:id/confirmar',
  requireRol('diagnotest'),
  ah(async (req, res) => {
    const { rows: existingRows } = await pool.query('SELECT * FROM turnos WHERE id = $1', [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Turno no encontrado' });
    if (existing.estado !== 'pendiente') {
      return res.status(409).json({ error: `El turno ya fue respondido (${existing.estado})` });
    }

    await pool.query(
      "UPDATE turnos SET estado = 'confirmado', respondido_en = NOW() WHERE id = $1",
      [req.params.id]
    );

    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    res.json(rows[0]);
  })
);

router.post(
  '/:id/rechazar',
  requireRol('diagnotest'),
  ah(async (req, res) => {
    const { rows: existingRows } = await pool.query('SELECT * FROM turnos WHERE id = $1', [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Turno no encontrado' });
    if (existing.estado !== 'pendiente') {
      return res.status(409).json({ error: `El turno ya fue respondido (${existing.estado})` });
    }

    const { motivo } = req.body || {};
    await pool.query(
      `UPDATE turnos
       SET estado = 'rechazado', respondido_en = NOW(), motivo_rechazo = $1
       WHERE id = $2`,
      [motivo || null, req.params.id]
    );

    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    res.json(rows[0]);
  })
);

export default router;
