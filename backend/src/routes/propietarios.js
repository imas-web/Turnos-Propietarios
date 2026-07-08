import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const propietarios = db
    .prepare('SELECT * FROM propietarios ORDER BY nombre ASC')
    .all();
  res.json(propietarios);
});

router.get('/:id', (req, res) => {
  const propietario = db
    .prepare('SELECT * FROM propietarios WHERE id = ?')
    .get(req.params.id);
  if (!propietario) return res.status(404).json({ error: 'Propietario no encontrado' });
  res.json(propietario);
});

router.post('/', (req, res) => {
  const { nombre, email, telefono, unidad } = req.body || {};
  if (!nombre || !email || !unidad) {
    return res.status(400).json({ error: 'nombre, email y unidad son requeridos' });
  }

  const info = db
    .prepare(
      'INSERT INTO propietarios (nombre, email, telefono, unidad) VALUES (?, ?, ?, ?)'
    )
    .run(nombre, email, telefono || null, unidad);

  const propietario = db
    .prepare('SELECT * FROM propietarios WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json(propietario);
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM propietarios WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Propietario no encontrado' });

  const { nombre, email, telefono, unidad, activo } = req.body || {};
  db.prepare(
    `UPDATE propietarios
     SET nombre = ?, email = ?, telefono = ?, unidad = ?, activo = ?
     WHERE id = ?`
  ).run(
    nombre ?? existing.nombre,
    email ?? existing.email,
    telefono ?? existing.telefono,
    unidad ?? existing.unidad,
    activo === undefined ? existing.activo : activo ? 1 : 0,
    req.params.id
  );

  const propietario = db
    .prepare('SELECT * FROM propietarios WHERE id = ?')
    .get(req.params.id);
  res.json(propietario);
});

router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM propietarios WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Propietario no encontrado' });

  db.prepare('DELETE FROM propietarios WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
