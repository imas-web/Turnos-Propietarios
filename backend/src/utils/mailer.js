import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

// Envia el correo de confirmacion de turno. Si no hay SMTP configurado,
// simplemente deja constancia en consola para no bloquear el flujo:
// el link de confirmacion siempre queda disponible en el panel admin.
export async function enviarCorreoConfirmacion({ to, nombre, turno, link }) {
  const asunto = `Confirmacion de turno: ${turno.titulo} (${turno.fecha})`;
  const texto = `Hola ${nombre},\n\n` +
    `Se te asigno el turno "${turno.titulo}" para el ${turno.fecha} de ${turno.hora_inicio} a ${turno.hora_fin}.\n` +
    `Por favor confirma o rechaza tu asistencia ingresando al siguiente enlace:\n${link}\n\n` +
    `Gracias.`;

  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] SMTP no configurado. Link de confirmacion para ${to}: ${link}`);
    return { enviado: false, link };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || 'Turnos Propietarios <no-responder@turnos.local>',
    to,
    subject: asunto,
    text: texto,
  });
  return { enviado: true, link };
}
