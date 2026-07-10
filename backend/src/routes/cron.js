import { Router } from 'express';
import { pool } from '../db.js';
import { ah } from '../utils/asyncHandler.js';
import { enviarCorreoRecordatorio } from '../utils/mailer.js';
import { fechaYHoraActualEnArgentina, sumarDias } from '../utils/fechaArgentina.js';

const router = Router();

// Vercel Cron Jobs agrega automaticamente "Authorization: Bearer <CRON_SECRET>"
// cuando la variable de entorno CRON_SECRET esta configurada en el proyecto.
// Si no esta configurada, no se exige autenticacion (util para probar en local).
function autorizado(req) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return true;
  return req.get('authorization') === `Bearer ${secreto}`;
}

// Envia el recordatorio del dia previo a todos los turnos confirmados para
// "manana" (segun la hora de Argentina) que todavia no lo recibieron.
// Pensado para ser invocado una vez por dia por un Vercel Cron Job.
router.get(
  '/recordatorios',
  ah(async (req, res) => {
    if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado' });

    const { fecha: hoy } = fechaYHoraActualEnArgentina();
    const manana = sumarDias(hoy, 1);

    const { rows } = await pool.query(
      `SELECT * FROM turnos
       WHERE estado = 'confirmado' AND recordatorio_enviado = false AND fecha = $1`,
      [manana]
    );

    for (const turno of rows) {
      try {
        await enviarCorreoRecordatorio({ to: turno.email, tutor: turno.tutor, turno });
      } catch (err) {
        console.error(
          'No se pudo enviar el recordatorio:',
          err.code || '',
          err.response || err.message || err
        );
      }
      await pool.query('UPDATE turnos SET recordatorio_enviado = true WHERE id = $1', [turno.id]);
    }

    res.json({ fecha: manana, procesados: rows.length });
  })
);

export default router;
