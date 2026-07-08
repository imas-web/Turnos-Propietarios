import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRol('admin'));

const ROLES_GESTIONABLES = ['extraccionista', 'diagnotest'];

router.get(
  '/',
  ah(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, usuario, rol, nombre, creado_en FROM usuarios
       WHERE rol = ANY($1) ORDER BY nombre ASC`,
      [ROLES_GESTIONABLES]
    );
    res.json(rows);
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const { usuario, password, rol, nombre } = req.body || {};
    if (!usuario || !password || !rol || !nombre) {
      return res.status(400).json({ error: 'usuario, password, rol y nombre son requeridos' });
    }
    if (!ROLES_GESTIONABLES.includes(rol)) {
      return res.status(400).json({ error: `rol debe ser uno de: ${ROLES_GESTIONABLES.join(', ')}` });
    }

    const { rows: existentes } = await pool.query('SELECT id FROM usuarios WHERE usuario = $1', [
      usuario,
    ]);
    if (existentes[0]) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese nombre de usuario' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (usuario, password_hash, rol, nombre)
       VALUES ($1, $2, $3, $4)
       RETURNING id, usuario, rol, nombre, creado_en`,
      [usuario, hash, rol, nombre]
    );
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM usuarios WHERE id = $1 AND rol = ANY($2)',
      [req.params.id, ROLES_GESTIONABLES]
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { nombre, rol, password } = req.body || {};
    if (rol && !ROLES_GESTIONABLES.includes(rol)) {
      return res.status(400).json({ error: `rol debe ser uno de: ${ROLES_GESTIONABLES.join(', ')}` });
    }

    const nuevoHash = password ? bcrypt.hashSync(password, 10) : existing.password_hash;
    const { rows } = await pool.query(
      `UPDATE usuarios
       SET nombre = $1, rol = $2, password_hash = $3
       WHERE id = $4
       RETURNING id, usuario, rol, nombre, creado_en`,
      [nombre ?? existing.nombre, rol ?? existing.rol, nuevoHash, req.params.id]
    );
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    try {
      const { rows } = await pool.query(
        'DELETE FROM usuarios WHERE id = $1 AND rol = ANY($2) RETURNING id',
        [req.params.id, ROLES_GESTIONABLES]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.status(204).send();
    } catch (err) {
      if (err.code === '23503') {
        return res.status(409).json({
          error: 'No se puede eliminar: tiene propietarios o turnos asociados',
        });
      }
      throw err;
    }
  })
);

export default router;
