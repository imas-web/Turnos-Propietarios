import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

const SELECT_TURNO = `
  SELECT t.*, p.nombre AS propietario_nombre, p.unidad AS propietario_unidad
  FROM turnos t
  JOIN propietarios p ON p.id = t.propietario_id
  WHERE t.token = ?
`;

// Endpoint publico: no requiere autenticacion, solo conocer el token
// unico enviado al propietario por correo.
router.get('/:token', (req, res) => {
  const turno = db.prepare(SELECT_TURNO).get(req.params.token);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado o link invalido' });

  const { token, ...turnoSinToken } = turno;
  res.json(turnoSinToken);
});

router.post('/:token/confirmar', (req, res) => {
  const turno = db.prepare(SELECT_TURNO).get(req.params.token);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado o link invalido' });
  if (turno.estado !== 'pendiente') {
    return res.status(409).json({ error: `El turno ya fue respondido (${turno.estado})` });
  }

  db.prepare(
    "UPDATE turnos SET estado = 'confirmado', respondido_en = datetime('now') WHERE token = ?"
  ).run(req.params.token);

  const actualizado = db.prepare(SELECT_TURNO).get(req.params.token);
  const { token, ...turnoSinToken } = actualizado;
  res.json(turnoSinToken);
});

router.post('/:token/rechazar', (req, res) => {
  const turno = db.prepare(SELECT_TURNO).get(req.params.token);
  if (!turno) return res.status(404).json({ error: 'Turno no encontrado o link invalido' });
  if (turno.estado !== 'pendiente') {
    return res.status(409).json({ error: `El turno ya fue respondido (${turno.estado})` });
  }

  const { motivo } = req.body || {};
  db.prepare(
    "UPDATE turnos SET estado = 'rechazado', respondido_en = datetime('now'), motivo_rechazo = ? WHERE token = ?"
  ).run(motivo || null, req.params.token);

  const actualizado = db.prepare(SELECT_TURNO).get(req.params.token);
  const { token, ...turnoSinToken } = actualizado;
  res.json(turnoSinToken);
});

export default router;
