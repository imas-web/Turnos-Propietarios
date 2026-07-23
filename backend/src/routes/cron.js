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

// Envia el recordatorio a los turnos confirmados para "hoy" o "manana"
// (segun la hora de Argentina) que todavia no lo recibieron. Se incluye
// "hoy" ademas de "manana" porque el cron solo corre una vez por dia: un
// turno que se confirma despues de la corrida del dia (para el dia
// siguiente) recien podria volver a evaluarse en la corrida siguiente, para
// la cual esa fecha ya seria "hoy" y no "manana" — sin este margen, nunca
// recibiria el recordatorio.
// Pensado para ser invocado una vez por dia por un Vercel Cron Job.
router.get(
  '/recordatorios',
  ah(async (req, res) => {
    if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado' });

    const { fecha: hoy } = fechaYHoraActualEnArgentina();
    const manana = sumarDias(hoy, 1);

    const { rows } = await pool.query(
      `SELECT * FROM turnos
       WHERE estado = 'confirmado' AND recordatorio_enviado = false
         AND fecha BETWEEN $1 AND $2`,
      [hoy, manana]
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

    res.json({ desde: hoy, hasta: manana, procesados: rows.length });
  })
);

const DIAS_RETENCION = 30;

// Elimina definitivamente los turnos de dias que ya pasaron hace mas de
// DIAS_RETENCION. Mientras tanto, esos turnos ya quedan ocultos del uso
// normal de la app (ver GET /api/turnos), pero siguen en la base por si
// hace falta consultarlos pidiendo esa fecha puntual.
// Pensado para ser invocado una vez por dia por un Vercel Cron Job.
router.get(
  '/limpieza',
  ah(async (req, res) => {
    if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado' });

    const { fecha: hoy } = fechaYHoraActualEnArgentina();
    const limite = sumarDias(hoy, -DIAS_RETENCION);

    const { rows } = await pool.query('DELETE FROM turnos WHERE fecha < $1 RETURNING id', [
      limite,
    ]);

    res.json({ limite, eliminados: rows.length });
  })
);

export default router;
