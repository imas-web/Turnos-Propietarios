import nodemailer from 'nodemailer';
import { fechaYHoraActualEnArgentina } from './fechaArgentina.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  // Gmail muestra las contrasenas de aplicacion en grupos separados por
  // espacios ("abcd efgh ijkl mnop"); si se pegan tal cual, Gmail rechaza
  // el login. Se quitan espacios y saltos de linea por las dudas.
  const usuario = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : undefined;
  const clave = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: usuario ? { user: usuario, pass: clave } : undefined,
  });
  return transporter;
}

async function enviarCorreo({ to, asunto, texto }) {
  if (!to) return { enviado: false, motivo: 'sin email cargado' };

  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] SMTP no configurado. Correo "${asunto}" no enviado a ${to}.`);
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

// Envia el correo con las instrucciones para whatsapp/pago cuando la
// extraccionista registra un turno nuevo.
export async function enviarCorreoDatosTurno({ to, tutor, turno }) {
  const asunto = `Turno registrado - ${turno.fecha} ${turno.hora_inicio}`;
  const texto =
    `Hola ${tutor},\n\n` +
    `Registramos tu turno de extraccion para el ${turno.fecha} a las ${turno.hora_inicio}.\n\n` +
    `Para poder procesar la extraccion, por favor envianos los siguientes datos por WhatsApp al 1140611502:\n\n` +
    `- Nombre de la mascota:\n` +
    `- Especie (canino, felino, otro), Raza, Sexo y Edad de la mascota:\n` +
    `- Nombre completo del responsable:\n` +
    `- Detallar Nº de historia clinica (en caso de tener):\n` +
    `- Telefono de contacto:\n` +
    `- Direccion de retiro/extraccion (agregar entre calles y zona de residencia):\n` +
    `- Direccion de correo electronico:\n\n` +
    `Importante tener la orden impresa al momento del retiro de la muestra con NUM. de SEGUIMIENTO indicado por Diagnotest, SINO NO SERA RETIRADA LA MUESTRA.\n\n` +
    `DATOS BANCARIOS - Forma de pago (Transferencia, deposito o mercadopago):\n\n` +
    `Banco: Frances BBVA\n` +
    `Nº C/C: 151-9559/9\n` +
    `CBU: 0170151320000000955991\n` +
    `Alias: DIAGNOTEST\n\n` +
    `RECUERDE que para analisis de sangre, el ayuno es entre 8 a 12 hs, consulte segun estudio. El valor NO incluye extraccion.\n\n` +
    `WhatsApp: 1140611502`;

  return enviarCorreo({ to, asunto, texto });
}

// Envia el correo de confirmacion cuando Diagnotest confirma un turno.
export async function enviarCorreoConfirmacion({ to, tutor, turno }) {
  const asunto = `Turno confirmado - ${turno.fecha} ${turno.hora_inicio}`;
  const texto =
    `Hola ${tutor},\n\n` +
    `Te confirmamos tu turno de extraccion:\n` +
    `Fecha: ${turno.fecha}\n` +
    `Horario: ${turno.hora_inicio} a ${turno.hora_fin}\n` +
    `Direccion: ${turno.direccion || '-'}\n\n` +
    `Gracias.`;

  return enviarCorreo({ to, asunto, texto });
}

// Envia el recordatorio para turnos ya confirmados que son "hoy" o
// "manana" (ver comentario en routes/cron.js sobre por que puede ser hoy).
export async function enviarCorreoRecordatorio({ to, tutor, turno }) {
  const esHoy = turno.fecha === fechaYHoraActualEnArgentina().fecha;
  const cuando = esHoy ? 'hoy' : 'mañana';

  const asunto = `Recordatorio: turno ${cuando} - ${turno.fecha} ${turno.hora_inicio}`;
  const texto =
    `Hola ${tutor},\n\n` +
    `Te recordamos que ${cuando} tenes tu turno de extraccion:\n` +
    `Fecha: ${turno.fecha}\n` +
    `Horario: ${turno.hora_inicio} a ${turno.hora_fin}\n` +
    `Direccion: ${turno.direccion || '-'}\n\n` +
    `Gracias.`;

  return enviarCorreo({ to, asunto, texto });
}
