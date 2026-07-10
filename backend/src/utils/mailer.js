import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

// Envia el correo de confirmacion cuando Diagnotest confirma un turno. Si
// no hay SMTP configurado, deja constancia en el log y no bloquea el flujo.
export async function enviarCorreoConfirmacion({ to, tutor, turno }) {
  if (!to) return { enviado: false, motivo: 'sin email cargado' };

  const asunto = `Turno confirmado - ${turno.fecha} ${turno.hora_inicio}`;
  const texto =
    `Hola ${tutor},\n\n` +
    `Te confirmamos tu turno de extraccion:\n` +
    `Fecha: ${turno.fecha}\n` +
    `Horario: ${turno.hora_inicio} a ${turno.hora_fin}\n` +
    `Direccion: ${turno.direccion || '-'}\n\n` +
    `Gracias.`;

  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] SMTP no configurado. Correo de confirmacion no enviado a ${to}.`);
    return { enviado: false, motivo: 'SMTP no configurado' };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: asunto,
    text: texto,
  });
  return { enviado: true };
}
