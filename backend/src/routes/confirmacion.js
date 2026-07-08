import { Router } from 'express';
import { pool } from '../db.js';
import { ah } from '../utils/asyncHandler.js';

const router = Router();

const SELECT_TURNO = `
  SELECT t.*, p.nombre AS propietario_nombre, p.unidad AS propietario_unidad
  FROM turnos t
  JOIN propietarios p ON p.id = t.propietario_id
  WHERE t.token = $1
`;

// Endpoint publico: no requiere autenticacion, solo conocer el token
// unico enviado al propietario por correo.
router.get(
  '/:token',
  ah(async (req, res) => {
    const { rows } = await pool.query(SELECT_TURNO, [req.params.token]);
    const turno = rows[0];
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado o link invalido' });

    const { token, ...turnoSinToken } = turno;
    res.json(turnoSinToken);
  })
);

router.post(
  '/:token/confirmar',
  ah(async (req, res) => {
    const { rows } = await pool.query(SELECT_TURNO, [req.params.token]);
    const turno = rows[0];
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado o link invalido' });
    if (turno.estado !== 'pendiente') {
      return res.status(409).json({ error: `El turno ya fue respondido (${turno.estado})` });
    }

    await pool.query(
      "UPDATE turnos SET estado = 'confirmado', respondido_en = NOW() WHERE token = $1",
      [req.params.token]
    );

    const { rows: actualizadoRows } = await pool.query(SELECT_TURNO, [req.params.token]);
    const { token, ...turnoSinToken } = actualizadoRows[0];
    res.json(turnoSinToken);
  })
);

router.post(
  '/:token/rechazar',
  ah(async (req, res) => {
    const { rows } = await pool.query(SELECT_TURNO, [req.params.token]);
    const turno = rows[0];
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado o link invalido' });
    if (turno.estado !== 'pendiente') {
      return res.status(409).json({ error: `El turno ya fue respondido (${turno.estado})` });
    }

    const { motivo } = req.body || {};
    await pool.query(
      `UPDATE turnos
       SET estado = 'rechazado', respondido_en = NOW(), motivo_rechazo = $1
       WHERE token = $2`,
      [motivo || null, req.params.token]
    );

    const { rows: actualizadoRows } = await pool.query(SELECT_TURNO, [req.params.token]);
    const { token, ...turnoSinToken } = actualizadoRows[0];
    res.json(turnoSinToken);
  })
);

export default router;
