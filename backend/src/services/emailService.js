const nodemailer = require('nodemailer');

function correoHabilitado() {
  return String(process.env.MAIL_ENABLED || 'false').toLowerCase() === 'true';
}

function crearTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function textoSeguro(valor) {
  return String(valor || '').trim();
}

function escapeHtml(valor = '') {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(valor = '') {
  return escapeHtml(valor).replace(/\n/g, '<br>');
}

function generarTextoPlano({ alerta, payload, observacionFinal }) {
  const ticket = alerta?.ticket || 'Sin ticket';

  return `
ALERTA INTERNA MEDIDATA

Ticket: ${ticket}
Nivel de riesgo: ${alerta?.nivel_riesgo || payload?.riesgo || 'No indicado'}
Tipo de caso: ${alerta?.tipo_caso || payload?.tipo_caso || 'No indicado'}
Estado: ${alerta?.estado || 'Pendiente de revisión'}

DATOS DEL REPORTANTE
Nombre: ${payload?.nombre || payload?.nombre_titular || 'No indicado'}
Cédula: ${payload?.cedula || 'No indicada'}
Correo: ${payload?.correo || 'No indicado'}
Teléfono: ${payload?.telefono || 'No indicado'}

REPORTE ORDENADO
${observacionFinal || alerta?.observacion || 'Sin observación registrada'}

ACCIÓN REQUERIDA
Revisar el caso en el panel interno de MediData y derivar a Ciberseguridad, Legal o Atención al Paciente según corresponda.
`;
}

function generarHtmlAlerta({ alerta, payload, observacionFinal }) {
  const ticket = escapeHtml(alerta?.ticket || 'Sin ticket');
  const nivel = escapeHtml(alerta?.nivel_riesgo || payload?.riesgo || 'No indicado');
  const tipoCaso = escapeHtml(alerta?.tipo_caso || payload?.tipo_caso || 'No indicado');
  const estado = escapeHtml(alerta?.estado || 'Pendiente de revisión');

  const nombre = escapeHtml(payload?.nombre || payload?.nombre_titular || 'No indicado');
  const cedula = escapeHtml(payload?.cedula || 'No indicada');
  const correo = escapeHtml(payload?.correo || 'No indicado');
  const telefono = escapeHtml(payload?.telefono || 'No indicado');

  const reporte = nl2br(observacionFinal || alerta?.observacion || 'Sin observación registrada.');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Alerta interna MediData</title>
</head>
<body style="margin:0;padding:0;background:#eef3f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:0 0 14px 14px;overflow:hidden;">

    <div style="background:linear-gradient(90deg,#064663,#08a8b8);padding:30px 26px;text-align:center;">
      <div style="display:inline-block;background:#ffffff;border-radius:16px;padding:18px 26px;margin-bottom:16px;">
        <div style="font-size:22px;font-weight:800;color:#064663;letter-spacing:.2px;">
          MediData ARCO+ Guardián
        </div>
        <div style="font-size:12px;color:#0f766e;margin-top:4px;">
          Protección de datos personales en salud
        </div>
      </div>

      <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.25;">
        Alerta interna de emergencia
      </h1>
      <p style="margin:8px 0 0 0;color:#dff7fb;font-size:14px;">
        MediData EC · Revisión humana prioritaria
      </p>
    </div>

    <div style="padding:22px 24px 8px 24px;">
      <div style="border-left:6px solid #dc2626;background:#fff1f2;border-radius:10px;padding:16px 18px;">
        <div style="font-size:22px;font-weight:800;color:#b91c1c;">
          Nivel de riesgo: ${nivel}
        </div>
        <div style="font-size:14px;color:#4b5563;margin-top:6px;">
          Este caso requiere revisión por canal formal seguro y atención prioritaria.
        </div>
      </div>
    </div>

    <div style="padding:16px 24px 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #cbd5e1;font-size:14px;">
        <tr>
          <td style="width:32%;padding:12px;background:#eaf2f6;border:1px solid #cbd5e1;font-weight:700;">Ticket</td>
          <td style="padding:12px;border:1px solid #cbd5e1;">${ticket}</td>
        </tr>
        <tr>
          <td style="padding:12px;background:#eaf2f6;border:1px solid #cbd5e1;font-weight:700;">Tipo de caso</td>
          <td style="padding:12px;border:1px solid #cbd5e1;">${tipoCaso}</td>
        </tr>
        <tr>
          <td style="padding:12px;background:#eaf2f6;border:1px solid #cbd5e1;font-weight:700;">Estado</td>
          <td style="padding:12px;border:1px solid #cbd5e1;">${estado}</td>
        </tr>
        <tr>
          <td style="padding:12px;background:#eaf2f6;border:1px solid #cbd5e1;font-weight:700;">Nombre reportado</td>
          <td style="padding:12px;border:1px solid #cbd5e1;">${nombre}</td>
        </tr>
        <tr>
          <td style="padding:12px;background:#eaf2f6;border:1px solid #cbd5e1;font-weight:700;">Cédula</td>
          <td style="padding:12px;border:1px solid #cbd5e1;">${cedula}</td>
        </tr>
        <tr>
          <td style="padding:12px;background:#eaf2f6;border:1px solid #cbd5e1;font-weight:700;">Correo / Teléfono</td>
          <td style="padding:12px;border:1px solid #cbd5e1;">${correo} / ${telefono}</td>
        </tr>
      </table>
    </div>

    <div style="padding:22px 24px 0 24px;">
      <h2 style="margin:0 0 10px 0;font-size:18px;color:#064663;">
        Reporte ordenado del caso
      </h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;line-height:1.65;font-size:14px;">
        ${reporte}
      </div>
    </div>

    <div style="padding:22px 24px 0 24px;">
      <h2 style="margin:0 0 10px 0;font-size:18px;color:#064663;">
        Áreas que deben intervenir
      </h2>
      <ul style="margin:0 0 0 20px;padding:0;line-height:1.8;font-size:14px;">
        <li>Ciberseguridad</li>
        <li>Legal / Cumplimiento</li>
        <li>Atención al Paciente</li>
        <li>Responsable de Protección de Datos</li>
      </ul>
    </div>

    <div style="padding:22px 24px 0 24px;">
      <h2 style="margin:0 0 10px 0;font-size:18px;color:#064663;">
        Acciones recomendadas
      </h2>
      <ol style="margin:0 0 0 20px;padding:0;line-height:1.8;font-size:14px;">
        <li>Validar identidad del titular por canal seguro.</li>
        <li>Preservar evidencia digital sin modificarla.</li>
        <li>Registrar formalmente el caso en el panel interno.</li>
        <li>Revisar accesos, exposición o uso indebido de datos relacionados.</li>
        <li>Escalar a las áreas responsables según nivel de riesgo.</li>
        <li>Contactar al afectado únicamente por canal formal seguro.</li>
      </ol>
    </div>

    <div style="padding:22px 24px 28px 24px;">
      <div style="background:#fff8e1;border-left:5px solid #f59e0b;border-radius:10px;padding:15px;">
        <strong style="display:block;color:#7c4a03;margin-bottom:6px;">Nota de seguridad</strong>
        <span style="font-size:13px;line-height:1.6;color:#4b5563;">
          Esta alerta fue generada por MediData ARCO+ Guardián. No responder al paciente desde este correo.
          Toda gestión debe realizarse por el canal interno formal y seguro.
        </span>
      </div>
    </div>

  </div>
</body>
</html>
`;
}


async function enviarPinLoginEmail({ usuario, pin }) {
  if (!correoHabilitado()) {
    console.log('Correo PIN no enviado: MAIL_ENABLED=false');
    return { ok: false, motivo: 'correo_deshabilitado' };
  }

  const destinatario = usuario?.correo;
  const remitente = process.env.MAIL_FROM || process.env.SMTP_USER;

  if (!destinatario || !remitente || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Correo PIN no enviado: configuración SMTP incompleta');
    return { ok: false, motivo: 'configuracion_incompleta' };
  }

  const nombre = escapeHtml(usuario?.nombres || 'Paciente');
  const pinSeguro = escapeHtml(pin);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>PIN de acceso MediData</title>
</head>
<body style="margin:0;padding:0;background:#eef3f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:0 0 14px 14px;overflow:hidden;">
    <div style="background:linear-gradient(90deg,#064663,#08a8b8);padding:28px;text-align:center;">
      <div style="display:inline-block;background:#ffffff;border-radius:16px;padding:16px 24px;margin-bottom:14px;">
        <div style="font-size:20px;font-weight:800;color:#064663;">MediData ARCO+ Guardián</div>
        <div style="font-size:12px;color:#0f766e;margin-top:4px;">Acceso seguro de paciente</div>
      </div>
      <h1 style="margin:0;color:#ffffff;font-size:26px;">Código PIN de verificación</h1>
      <p style="margin:8px 0 0 0;color:#dff7fb;font-size:14px;">Protección de datos personales en salud</p>
    </div>

    <div style="padding:26px;">
      <p style="font-size:15px;line-height:1.6;margin-top:0;">
        Hola ${nombre}, recibimos una solicitud de acceso seguro a MediData.
      </p>

      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;text-align:center;padding:22px;margin:20px 0;">
        <div style="font-size:13px;color:#075985;font-weight:700;margin-bottom:8px;">Tu código PIN es:</div>
        <div style="font-size:36px;letter-spacing:8px;font-weight:900;color:#064663;">${pinSeguro}</div>
      </div>

      <p style="font-size:14px;line-height:1.6;color:#4b5563;">
        Este PIN es temporal y debe usarse únicamente para continuar el proceso de verificación dentro del portal MediData.
      </p>

      <div style="background:#fff8e1;border-left:5px solid #f59e0b;border-radius:10px;padding:14px;margin-top:20px;">
        <strong style="display:block;color:#7c4a03;margin-bottom:6px;">Nota de seguridad</strong>
        <span style="font-size:13px;line-height:1.6;color:#4b5563;">
          No compartas este PIN con terceros. MediData nunca te pedirá este código por WhatsApp, llamada informal o redes sociales.
        </span>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const texto = `
MEDIDATA ARCO+ GUARDIÁN

Hola ${usuario?.nombres || 'Paciente'}.

Tu PIN de verificación es: ${pin}

No compartas este código con terceros.
`;

  const transporter = crearTransporter();

  await transporter.sendMail({
    from: remitente,
    to: destinatario,
    subject: '[MediData] PIN de verificación',
    text: texto,
    html,
  });

  console.log(`Correo PIN enviado a ${destinatario}`);
  return { ok: true };
}

async function enviarAlertaEmergenciaEmail({ alerta, payload, observacionFinal }) {
  if (!correoHabilitado()) {
    console.log('Correo de alerta no enviado: MAIL_ENABLED=false');
    return { ok: false, motivo: 'correo_deshabilitado' };
  }

  const destinatario = process.env.ALERT_EMAIL_TO;
  const remitente = process.env.MAIL_FROM || process.env.SMTP_USER;

  if (!destinatario || !remitente || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Correo de alerta no enviado: configuración SMTP incompleta');
    return { ok: false, motivo: 'configuracion_incompleta' };
  }

  const ticket = alerta?.ticket || 'Sin ticket';
  const asunto = `[MediData] Alerta crítica ${ticket}`;

  const transporter = crearTransporter();

  await transporter.sendMail({
    from: remitente,
    to: destinatario,
    subject: asunto,
    text: generarTextoPlano({ alerta, payload, observacionFinal }),
    html: generarHtmlAlerta({ alerta, payload, observacionFinal }),
  });

  console.log(`Correo de alerta enviado para ticket ${ticket}`);
  return { ok: true };
}

module.exports = {
  enviarAlertaEmergenciaEmail,
  enviarPinLoginEmail,
};
