import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { ah } from '../utils/asyncHandler.js';
import { enviarCorreoConfirmacion, enviarCorreoDatosTurno } from '../utils/mailer.js';
import { fechaYHoraActualEnArgentina } from '../utils/fechaArgentina.js';

const router = Router();

const MINUTOS_INICIO_LABORAL = 8 * 60;
const MINUTOS_FIN_LABORAL = 20 * 60;
const PASO_MINUTOS = 15;

const SELECT_TURNO = `
  SELECT t.*, u.nombre AS creado_por_nombre
  FROM turnos t
  LEFT JOIN usuarios u ON u.id = t.creado_por
`;

function generarSlots() {
  const slots = [];
  for (let min = MINUTOS_INICIO_LABORAL; min < MINUTOS_FIN_LABORAL; min += PASO_MINUTOS) {
    slots.push(minutosAHora(min));
  }
  return slots;
}

function minutosAHora(minutos) {
  const h = String(Math.floor(minutos / 60) % 24).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function horaAMinutos(horaHHMM) {
  const [h, m] = horaHHMM.split(':').map(Number);
  return h * 60 + m;
}

function sumarMinutos(horaHHMM, minutos) {
  return minutosAHora(horaAMinutos(horaHHMM) + minutos);
}

router.use(requireAuth);

router.get(
  '/disponibilidad',
  requireRol('extraccionista'),
  ah(async (req, res) => {
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ error: 'fecha es requerida' });

    const { rows } = await pool.query(
      `SELECT hora_inicio FROM turnos
       WHERE creado_por = $1 AND fecha = $2 AND estado IN ('pendiente', 'confirmado')`,
      [req.usuario.sub, fecha]
    );
    const ocupados = new Set(rows.map((r) => r.hora_inicio));

    const ahora = fechaYHoraActualEnArgentina();
    const esHoy = fecha === ahora.fecha;

    const slots = generarSlots().filter((slot) => {
      if (ocupados.has(slot)) return false;
      if (esHoy && horaAMinutos(slot) <= ahora.minutos) return false;
      return true;
    });

    res.json({ slots });
  })
);

// Lista liviana de extraccionistas activas, usada por Diagnotest para
// armar las columnas de la grilla del dia.
router.get(
  '/extraccionistas',
  requireRol('diagnotest'),
  ah(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id, nombre FROM usuarios WHERE rol = 'extraccionista' ORDER BY nombre ASC"
    );
    res.json(rows);
  })
);

router.get(
  '/',
  ah(async (req, res) => {
    const { estado, desde, hasta } = req.query;
    const condiciones = [];
    const params = [];

    if (req.usuario.rol === 'extraccionista') {
      params.push(req.usuario.sub);
      condiciones.push(`t.creado_por = $${params.length}`);
      // Los turnos rechazados no se muestran a la extraccionista.
      condiciones.push("t.estado != 'rechazado'");
    }
    if (estado) {
      params.push(estado);
      condiciones.push(`t.estado = $${params.length}`);
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
    if (
      req.usuario.rol === 'extraccionista' &&
      (turno.creado_por !== req.usuario.sub || turno.estado === 'rechazado')
    ) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    res.json(turno);
  })
);

router.post(
  '/',
  requireRol('extraccionista'),
  ah(async (req, res) => {
    const { tutor, telefono, direccion, email, fecha, hora_inicio } = req.body || {};

    if (!tutor || !telefono || !direccion || !email || !fecha || !hora_inicio) {
      return res.status(400).json({
        error: 'tutor, telefono, direccion, email y hora_inicio son requeridos',
      });
    }
    if (!generarSlots().includes(hora_inicio)) {
      return res.status(400).json({ error: 'Horario invalido' });
    }

    const hora_fin = sumarMinutos(hora_inicio, PASO_MINUTOS);

    try {
      const { rows: insertedRows } = await pool.query(
        `INSERT INTO turnos (tutor, telefono, direccion, email, fecha, hora_inicio, hora_fin, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [tutor, telefono, direccion, email, fecha, hora_inicio, hora_fin, req.usuario.sub]
      );

      const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [
        insertedRows[0].id,
      ]);
      const turno = rows[0];

      try {
        await enviarCorreoDatosTurno({ to: turno.email, tutor: turno.tutor, turno });
      } catch (err) {
        console.error(
          'No se pudo enviar el correo de datos del turno:',
          err.code || '',
          err.response || err.message || err
        );
      }

      res.status(201).json(turno);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Ese horario ya esta ocupado' });
      }
      throw err;
    }
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

    const { tutor, telefono, direccion, email, fecha, hora_inicio } = req.body || {};
    const nuevaHoraInicio = hora_inicio ?? existing.hora_inicio;
    const nuevaHoraFin = hora_inicio ? sumarMinutos(hora_inicio, PASO_MINUTOS) : existing.hora_fin;

    try {
      await pool.query(
        `UPDATE turnos
         SET tutor = $1, telefono = $2, direccion = $3, email = $4, fecha = $5, hora_inicio = $6, hora_fin = $7
         WHERE id = $8`,
        [
          tutor ?? existing.tutor,
          telefono ?? existing.telefono,
          direccion ?? existing.direccion,
          email ?? existing.email,
          fecha ?? existing.fecha,
          nuevaHoraInicio,
          nuevaHoraFin,
          req.params.id,
        ]
      );
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Ese horario ya esta ocupado' });
      }
      throw err;
    }

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

// Confirmacion/rechazo interno: solo el rol "diagnotest" puede resolver
// turnos pendientes, sin importar quien los haya cargado.
router.post(
  '/:id/confirmar',
  requireRol('diagnotest'),
  ah(async (req, res) => {
    const { numero_dt } = req.body || {};
    if (!numero_dt) {
      return res.status(400).json({ error: 'numero_dt es requerido para confirmar' });
    }

    const { rows: existingRows } = await pool.query('SELECT * FROM turnos WHERE id = $1', [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Turno no encontrado' });
    if (existing.estado !== 'pendiente') {
      return res.status(409).json({ error: `El turno ya fue respondido (${existing.estado})` });
    }

    await pool.query(
      "UPDATE turnos SET estado = 'confirmado', respondido_en = NOW(), numero_dt = $1 WHERE id = $2",
      [numero_dt, req.params.id]
    );

    const { rows } = await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    const turno = rows[0];

    try {
      await enviarCorreoConfirmacion({ to: turno.email, tutor: turno.tutor, turno });
    } catch (err) {
      console.error(
        'No se pudo enviar el correo de confirmacion:',
        err.code || '',
        err.response || err.message || err
      );
    }

    res.json(turno);
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
