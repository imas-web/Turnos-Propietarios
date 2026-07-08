import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  ah(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM propietarios ORDER BY nombre ASC');
    res.json(rows);
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM propietarios WHERE id = $1', [
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Propietario no encontrado' });
    res.json(rows[0]);
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const { nombre, email, telefono, unidad } = req.body || {};
    if (!nombre || !email || !unidad) {
      return res.status(400).json({ error: 'nombre, email y unidad son requeridos' });
    }

    const { rows } = await pool.query(
      `INSERT INTO propietarios (nombre, email, telefono, unidad)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre, email, telefono || null, unidad]
    );
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM propietarios WHERE id = $1',
      [req.params.id]
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Propietario no encontrado' });

    const { nombre, email, telefono, unidad, activo } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE propietarios
       SET nombre = $1, email = $2, telefono = $3, unidad = $4, activo = $5
       WHERE id = $6
       RETURNING *`,
      [
        nombre ?? existing.nombre,
        email ?? existing.email,
        telefono ?? existing.telefono,
        unidad ?? existing.unidad,
        activo === undefined ? existing.activo : activo ? 1 : 0,
        req.params.id,
      ]
    );
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const { rows } = await pool.query(
      'DELETE FROM propietarios WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Propietario no encontrado' });
    res.status(204).send();
  })
);

export default router;
