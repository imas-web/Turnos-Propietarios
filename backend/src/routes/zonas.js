import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

// Diagnotest la usa para saber a quien derivar un paciente segun la zona;
// Admin la usa para gestionar que zona cubre cada extraccionista.
router.get(
  '/',
  requireRol('admin', 'diagnotest'),
  ah(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT z.id, z.nombre, u.id AS extraccionista_id, u.nombre AS extraccionista_nombre
       FROM zonas z
       JOIN usuarios u ON u.id = z.extraccionista_id
       ORDER BY z.nombre ASC, u.nombre ASC`
    );
    res.json(rows);
  })
);

// Reemplaza por completo que extraccionistas cubren una zona (mas simple
// que ir agregando/quitando de a una): manda el nombre de la zona y la
// lista completa de extraccionistas que la cubren.
router.post(
  '/asignar',
  requireRol('admin'),
  ah(async (req, res) => {
    const { nombre, extraccionista_ids } = req.body || {};
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'nombre es requerido' });
    }
    const nombreNormalizado = nombre.trim();
    const ids = Array.isArray(extraccionista_ids) ? extraccionista_ids : [];

    await pool.query('DELETE FROM zonas WHERE lower(nombre) = lower($1)', [nombreNormalizado]);

    for (const id of ids) {
      await pool.query('INSERT INTO zonas (nombre, extraccionista_id) VALUES ($1, $2)', [
        nombreNormalizado,
        id,
      ]);
    }

    res.json({ nombre: nombreNormalizado, extraccionista_ids: ids });
  })
);

// Carga masiva: agrega (sin borrar lo existente) una lista de zonas para
// una o mas extraccionistas de una sola vez, util para cargar decenas de
// zonas pegando una lista en vez de una por una.
router.post(
  '/agregar-masivo',
  requireRol('admin'),
  ah(async (req, res) => {
    const { nombres, extraccionista_ids } = req.body || {};
    const listaNombres = Array.isArray(nombres)
      ? [...new Set(nombres.map((n) => (n || '').trim()).filter(Boolean))]
      : [];
    const listaIds = Array.isArray(extraccionista_ids) ? extraccionista_ids : [];

    if (listaNombres.length === 0 || listaIds.length === 0) {
      return res.status(400).json({ error: 'nombres y extraccionista_ids son requeridos' });
    }

    let insertados = 0;
    for (const nombre of listaNombres) {
      for (const id of listaIds) {
        const { rowCount } = await pool.query(
          `INSERT INTO zonas (nombre, extraccionista_id) VALUES ($1, $2)
           ON CONFLICT (nombre, extraccionista_id) DO NOTHING`,
          [nombre, id]
        );
        insertados += rowCount;
      }
    }

    res.json({ zonas: listaNombres.length, insertados });
  })
);

export default router;
