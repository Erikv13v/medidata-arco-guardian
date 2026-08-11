const argon2 = require('argon2');
const crypto = require('crypto');
const pool = require('../config/database');
const { responderIA, resumirEmergenciaIA } = require('../services/publicAiService');
const { enviarAlertaEmergenciaEmail, enviarPinLoginEmail } = require('../services/emailService');

const API_KEY_PERMITIDA = process.env.PUBLIC_API_KEY;

function leerPayload(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  return req.body || {};
}

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarIdentificacion(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function crearHmacIdentificacion(identificacion, secreto) {
  return crypto
    .createHmac('sha256', secreto)
    .update(identificacion)
    .digest('hex');
}

function obtenerHmacsPosibles(cedula) {
  const identificacion = normalizarIdentificacion(cedula);
  const secretos = [
    process.env.APP_SECRET,
    'MEDIDATA_DEMO_PEPPER_2026_CAMBIAR',
  ].filter(Boolean);

  return secretos.map((secreto) =>
    crearHmacIdentificacion(identificacion, secreto)
  );
}

function obtenerUltimos4(cedula) {
  const identificacion = normalizarIdentificacion(cedula) || '0000';
  return identificacion.slice(-4).padStart(4, '0');
}

function limpiarCorreo(correo) {
  return String(correo || '').trim().toLowerCase();
}

function usuarioPublico(row, cedula = '') {
  if (!row) return null;

  return {
    id_usuario: row.id_usuario,
    nombre: row.nombres,
    cedula,
    correo: row.correo,
    telefono: row.telefono,
    estado: row.estado,
  };
}

function respuestaError(res, mensaje, status = 400) {
  return res.status(status).json({
    ok: false,
    error: mensaje,
  });
}

async function buscarUsuarioPorDatos({ cedula, correo }) {
  const correoLimpio = limpiarCorreo(correo);
  const hmacs = obtenerHmacsPosibles(cedula);

  const resultado = await pool.query(
    `
    SELECT
      id_usuario,
      nombres,
      correo,
      telefono,
      estado,
      correo_verificado,
      password_hash
    FROM medidata.usuarios
    WHERE correo = $1
       OR identificacion_hmac::text = ANY($2::text[])
    LIMIT 1
    `,
    [correoLimpio, hmacs]
  );

  return resultado.rows[0] || null;
}

async function accionBuscarUsuario(payload, res) {
  const usuario = await buscarUsuarioPorDatos({
    cedula: payload.cedula,
    correo: payload.correo,
  });

  return res.json({
    ok: true,
    encontrado: Boolean(usuario),
    usuario: usuarioPublico(usuario, payload.cedula),
  });
}

async function accionCrearUsuario(payload, res) {
  const nombre = normalizarTexto(payload.nombre);
  const cedula = normalizarIdentificacion(payload.cedula);
  const correo = limpiarCorreo(payload.correo);
  const telefono = normalizarTexto(payload.telefono);
  const password = String(payload.password || '');

  if (!nombre || !cedula || !correo || !password) {
    return respuestaError(res, 'Faltan datos obligatorios');
  }

  if (password.length < 6) {
    return respuestaError(res, 'La contraseña debe tener mínimo 6 caracteres');
  }

  const secreto = process.env.APP_SECRET || 'MEDIDATA_DEMO_PEPPER_2026_CAMBIAR';
  const identificacionHmac = crearHmacIdentificacion(cedula, secreto);
  const passwordHash = await argon2.hash(password);

  try {
    const resultado = await pool.query(
      `
      INSERT INTO medidata.usuarios (
        nombres,
        identificacion_hmac,
        identificacion_ultimos4,
        correo,
        telefono,
        password_hash,
        correo_verificado
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING
        id_usuario,
        nombres,
        correo,
        telefono,
        estado
      `,
      [
        nombre,
        identificacionHmac,
        obtenerUltimos4(cedula),
        correo,
        telefono || null,
        passwordHash,
      ]
    );

    return res.status(201).json({
      ok: true,
      usuario: usuarioPublico(resultado.rows[0], cedula),
    });
  } catch (error) {
    if (error.code === '23505') {
      return respuestaError(res, 'La cédula o correo ya se encuentra registrado', 409);
    }

    throw error;
  }
}

async function accionGenerarPin(payload, res) {
  const usuario = await buscarUsuarioPorDatos({
    cedula: payload.cedula,
    correo: payload.correo,
  });

  if (!usuario) {
    return respuestaError(res, 'Usuario no encontrado', 404);
  }

  if (usuario.estado !== 'activo') {
    return respuestaError(res, 'Usuario no activo', 403);
  }

  const passwordValida = await argon2.verify(
    usuario.password_hash,
    String(payload.password || '')
  );

  if (!passwordValida) {
    return respuestaError(res, 'Credenciales incorrectas', 401);
  }

  const pin = crypto.randomInt(100000, 1000000).toString();
  const pinHash = await argon2.hash(pin);

  await pool.query(
    `
    UPDATE medidata.desafios_otp
    SET estado = 'revocado'
    WHERE id_usuario = $1
      AND proposito = 'login'
      AND estado = 'activo'
    `,
    [usuario.id_usuario]
  );

  await pool.query(
    `
    INSERT INTO medidata.desafios_otp (
      id_usuario,
      proposito,
      codigo_hash,
      expira_en,
      ip_solicitante
    )
    VALUES ($1, 'login', $2, now() + interval '10 minutes', $3)
    `,
    [usuario.id_usuario, pinHash, null]
  );

  try {
    await enviarPinLoginEmail({
      usuario,
      pin,
    });
  } catch (error) {
    console.error('Error enviando PIN por correo:', error.message);
    return respuestaError(res, 'No se pudo enviar el PIN al correo registrado', 500);
  }

  return res.json({
    ok: true,
    mensaje: 'PIN enviado correctamente al correo registrado',
    usuario: usuarioPublico(usuario, payload.cedula),
  });
}

async function accionVerificarPin(payload, res) {
  const usuario = await buscarUsuarioPorDatos({
    cedula: payload.cedula,
    correo: payload.correo,
  });

  if (!usuario) {
    return respuestaError(res, 'Usuario no encontrado', 404);
  }

  const otp = await pool.query(
    `
    SELECT id_otp, codigo_hash, intentos, max_intentos
    FROM medidata.desafios_otp
    WHERE id_usuario = $1
      AND proposito = 'login'
      AND estado = 'activo'
      AND expira_en > now()
    ORDER BY creado_en DESC
    LIMIT 1
    `,
    [usuario.id_usuario]
  );

  if (otp.rowCount === 0) {
    return respuestaError(res, 'PIN no existe o expiró', 401);
  }

  const registro = otp.rows[0];
  const pinValido = await argon2.verify(
    registro.codigo_hash,
    String(payload.pin || '')
  );

  if (!pinValido) {
    await pool.query(
      `
      UPDATE medidata.desafios_otp
      SET
        intentos = intentos + 1,
        estado = CASE
          WHEN intentos + 1 >= max_intentos THEN 'bloqueado'
          ELSE estado
        END
      WHERE id_otp = $1
      `,
      [registro.id_otp]
    );

    return respuestaError(res, 'PIN incorrecto', 401);
  }

  await pool.query(
    `
    UPDATE medidata.desafios_otp
    SET estado = 'usado', utilizado_en = now()
    WHERE id_otp = $1
    `,
    [registro.id_otp]
  );

  return res.json({
    ok: true,
    mensaje: 'PIN verificado correctamente',
    usuario: usuarioPublico(usuario, payload.cedula),
  });
}

function mapearTipoSolicitud(valor) {
  const texto = normalizarTexto(valor).toLowerCase();

  if (texto.includes('orientación') || texto.includes('atención inicial')) {
    return 'Orientación inicial';
  }

  if (texto.includes('acceso')) return 'Acceso';
  if (texto.includes('rectificación') || texto.includes('actualización')) {
    return 'Rectificación y actualización';
  }
  if (texto.includes('eliminación') || texto.includes('cancelación')) {
    return 'Eliminación o cancelación';
  }
  if (texto.includes('oposición')) return 'Oposición';
  if (texto.includes('portabilidad')) return 'Portabilidad';
  if (texto.includes('suspensión') || texto.includes('limitación')) {
    return 'Suspensión o limitación';
  }
  if (texto.includes('incidente') || texto.includes('amenaza') || texto.includes('filtración')) {
    return 'Incidente, amenaza o filtración';
  }

  return 'Orientación inicial';
}

async function buscarUsuarioParaRegistro(payload) {
  if (payload.id_usuario) {
    const resultado = await pool.query(
      `
      SELECT id_usuario, nombres, correo, telefono, estado
      FROM medidata.usuarios
      WHERE id_usuario = $1
      LIMIT 1
      `,
      [payload.id_usuario]
    );

    if (resultado.rowCount > 0) return resultado.rows[0];
  }

  return await buscarUsuarioPorDatos({
    cedula: payload.cedula,
    correo: payload.correo,
  });
}

function estadoSolicitudPermitido(valor) {
  const estados = [
    'Pendiente',
    'Pendiente de revisión',
    'En revisión',
    'Avanzado',
    'Culminado',
    'Derivado',
    'Rechazado',
  ];

  return estados.includes(valor) ? valor : 'Pendiente de revisión';
}

async function accionCrearSolicitud(payload, res) {
  const usuario = await buscarUsuarioParaRegistro(payload);

  if (!usuario) {
    return respuestaError(res, 'Usuario no encontrado', 404);
  }

  const tipoSolicitud = mapearTipoSolicitud(
    payload.tipo_solicitud || payload.solicitud || payload.derecho
  );

  const estado = estadoSolicitudPermitido(payload.estado);
  const observacion = normalizarTexto(
    payload.observacion || payload.descripcion || payload.resumen || ''
  );

  const resultado = await pool.query(
    `
    INSERT INTO medidata.solicitudes (
      id_usuario,
      tipo_solicitud,
      estado,
      observacion,
      canal
    )
    VALUES ($1, $2, $3, $4, 'Web pública MediData')
    RETURNING
      id_solicitud,
      ticket,
      tipo_solicitud,
      estado,
      observacion,
      canal,
      creado_en,
      actualizado_en
    `,
    [
      usuario.id_usuario,
      tipoSolicitud,
      estado,
      observacion || 'Solicitud registrada desde el portal público.',
    ]
  );

  const solicitud = resultado.rows[0];

  return res.status(201).json({
    ok: true,
    solicitud: {
      id_solicitud: solicitud.ticket,
      id_solicitud_real: solicitud.id_solicitud,
      ticket: solicitud.ticket,
      tipo_solicitud: solicitud.tipo_solicitud,
      estado: solicitud.estado,
      observacion: solicitud.observacion,
      canal: solicitud.canal,
      fecha_creacion: solicitud.creado_en,
      fecha_actualizacion: solicitud.actualizado_en,
    },
  });
}

function mapearNivelRiesgo(valor) {
  const texto = normalizarTexto(valor).toLowerCase();

  if (texto.includes('alto') || texto.includes('urgente') || texto.includes('crítico')) {
    return 'Alto';
  }

  if (texto.includes('medio') || texto.includes('moderado')) {
    return 'Medio';
  }

  return 'Bajo';
}

async function accionAlertaEmergencia(payload, res) {
  const usuario = await buscarUsuarioParaRegistro(payload);

  if (!usuario) {
    return respuestaError(res, 'Usuario no encontrado', 404);
  }

  const nivelRiesgo = mapearNivelRiesgo(payload.nivel_riesgo || payload.riesgo);
  const tipoCaso = normalizarTexto(
    payload.tipo_caso || payload.tipo || payload.motivo || 'Alerta reportada desde portal público'
  );
  const observacion = normalizarTexto(
    payload.observacion ||
    payload.descripcion ||
    payload.detalle ||
    payload.resumen ||
    payload.relato ||
    payload.evidencia ||
    ''
  );

  const resumenIa = await resumirEmergenciaIA({
    texto: observacion,
    nivelRiesgo,
    tipoCaso,
  });

  const observacionFinal = [
    observacion || 'Alerta registrada desde el portal público.',
    '',
    'Resumen IA para equipo interno:',
    resumenIa,
  ].join('\n').slice(0, 4000);

  const resultado = await pool.query(
    `
    INSERT INTO medidata.alertas_emergencia (
      id_usuario,
      nivel_riesgo,
      tipo_caso,
      estado,
      observacion
    )
    VALUES ($1, $2, $3, 'Pendiente de revisión', $4)
    RETURNING
      id_alerta,
      ticket,
      nivel_riesgo,
      tipo_caso,
      estado,
      observacion,
      creado_en,
      actualizado_en
    `,
    [
      usuario.id_usuario,
      nivelRiesgo,
      tipoCaso,
      observacionFinal,
    ]
  );

  const alerta = resultado.rows[0];

  try {
    await enviarAlertaEmergenciaEmail({
      alerta,
      payload,
      observacionFinal,
    });
  } catch (error) {
    console.error('Error enviando correo de alerta:', error.message);
  }

  return res.status(201).json({
    ok: true,
    ticket: alerta.ticket,
    id_alerta: alerta.ticket,
    id_alerta_real: alerta.id_alerta,
    alerta: {
      id_alerta: alerta.ticket,
      id_alerta_real: alerta.id_alerta,
      ticket: alerta.ticket,
      nivel_riesgo: alerta.nivel_riesgo,
      tipo_caso: alerta.tipo_caso,
      estado: alerta.estado,
      observacion: alerta.observacion,
      fecha_creacion: alerta.creado_en,
      fecha_actualizacion: alerta.actualizado_en,
    },
  });
}

async function buscarSolicitudPorTicket(ticket) {
  const resultado = await pool.query(
    `
    SELECT
      s.ticket,
      s.tipo_solicitud,
      s.estado,
      s.observacion,
      s.canal,
      s.creado_en,
      s.actualizado_en,
      p.nombre AS responsable
    FROM medidata.solicitudes s
    LEFT JOIN medidata.personal_interno p
      ON p.id_personal = s.id_responsable
    WHERE s.ticket = $1
    LIMIT 1
    `,
    [ticket]
  );

  return resultado.rows[0] || null;
}


async function buscarUltimaSolicitudUsuario(payload) {
  const usuario = await buscarUsuarioParaRegistro(payload);

  if (!usuario) return null;

  const resultado = await pool.query(
    `
    SELECT
      s.ticket,
      s.tipo_solicitud,
      s.estado,
      s.observacion,
      s.canal,
      s.creado_en,
      s.actualizado_en,
      p.nombre AS responsable
    FROM medidata.solicitudes s
    LEFT JOIN medidata.personal_interno p
      ON p.id_personal = s.id_responsable
    WHERE s.id_usuario = $1
    ORDER BY s.creado_en DESC
    LIMIT 1
    `,
    [usuario.id_usuario]
  );

  return resultado.rows[0] || null;
}

async function buscarEmergenciaPorTicket(ticket) {
  const resultado = await pool.query(
    `
    SELECT
      a.ticket,
      a.nivel_riesgo,
      a.tipo_caso,
      a.estado,
      a.observacion,
      a.creado_en,
      a.actualizado_en,
      p.nombre AS responsable
    FROM medidata.alertas_emergencia a
    LEFT JOIN medidata.personal_interno p
      ON p.id_personal = a.id_responsable
    WHERE a.ticket = $1
    LIMIT 1
    `,
    [ticket]
  );

  return resultado.rows[0] || null;
}


async function accionConsultarEstado(payload, res) {
  const ticket = normalizarTexto(payload.ticket).toUpperCase();

  async function responderSolicitud(solicitud, modo = 'ticket') {
    return res.json({
      ok: true,
      tipo_registro: 'solicitud',
      modo_consulta: modo,
      solicitud: {
        ticket: solicitud.ticket,
        tipo_solicitud: solicitud.tipo_solicitud,
        estado: solicitud.estado,
        observacion: solicitud.observacion,
        canal: solicitud.canal,
        responsable: solicitud.responsable,
        fecha_creacion: solicitud.creado_en,
        fecha_actualizacion: solicitud.actualizado_en,
      },
    });
  }

  if (!ticket) {
    const ultimaSolicitud = await buscarUltimaSolicitudUsuario(payload);

    if (!ultimaSolicitud) {
      return res.json({
        ok: false,
        error: 'No se encontró una solicitud asociada a tus datos registrados',
      });
    }

    return responderSolicitud(ultimaSolicitud, 'ultima_solicitud');
  }

  if (ticket.startsWith('SOL-')) {
    let solicitud = await buscarSolicitudPorTicket(ticket);

    if (!solicitud) {
      solicitud = await buscarUltimaSolicitudUsuario(payload);
    }

    if (!solicitud) {
      return res.json({
        ok: false,
        error: 'Solicitud no encontrada',
      });
    }

    return responderSolicitud(solicitud);
  }

  if (ticket.startsWith('MD-EMG-') || ticket.startsWith('MDD-EMG-')) {
    const alerta = await buscarEmergenciaPorTicket(ticket);

    if (!alerta) {
      return res.json({
        ok: false,
        error: 'Alerta no encontrada',
      });
    }

    return res.json({
      ok: true,
      tipo_registro: 'emergencia',
      alerta: {
        ticket: alerta.ticket,
        riesgo: alerta.nivel_riesgo,
        tipo_caso: alerta.tipo_caso,
        estado: alerta.estado,
        observacion: alerta.observacion,
        responsable: alerta.responsable,
        fecha_creacion: alerta.creado_en,
        fecha_actualizacion: alerta.actualizado_en,
      },
    });
  }

  const ultimaSolicitud = await buscarUltimaSolicitudUsuario(payload);

  if (!ultimaSolicitud) {
    return res.json({
      ok: false,
      error: 'Ingresa un ticket válido o registra una solicitud primero',
    });
  }

  return responderSolicitud(ultimaSolicitud, 'ultima_solicitud');
}

async function accionAlertaSeguridad(payload, res) {
  return res.json({
    ok: true,
    mensaje: 'Alerta de seguridad registrada para análisis interno',
  });
}

async function accionEnviarFormulario(payload, res) {
  return res.json({
    ok: true,
    mensaje: 'Formulario recibido correctamente',
  });
}

async function accionChatIa(payload, res) {
  const respuesta = await responderIA({
    mensaje: payload.mensaje || payload.texto || payload.pregunta,
    derecho:
      payload.derecho ||
      payload.tipo_solicitud ||
      payload.solicitud ||
      payload.modulo ||
      'orientación general',
  });

  return res.json({
    ok: true,
    mensaje: respuesta,
  });
}

async function manejarArcoPublico(req, res) {
  try {
    const payload = leerPayload(req);

    if (payload.api_key !== API_KEY_PERMITIDA) {
      return respuestaError(res, 'API key no autorizada', 401);
    }

    const tipo = normalizarTexto(payload.tipo).toLowerCase();

    if (tipo === 'buscar_usuario') {
      return await accionBuscarUsuario(payload, res);
    }

    if (tipo === 'crear_usuario') {
      return await accionCrearUsuario(payload, res);
    }

    if (tipo === 'generar_pin') {
      return await accionGenerarPin(payload, res);
    }

    if (tipo === 'verificar_pin') {
      return await accionVerificarPin(payload, res);
    }

    if (tipo === 'crear_solicitud') {
      return await accionCrearSolicitud(payload, res);
    }

    if (tipo === 'alerta_emergencia') {
      return await accionAlertaEmergencia(payload, res);
    }

    if (tipo === 'consultar_estado') {
      return await accionConsultarEstado(payload, res);
    }

    if (tipo === 'alerta_seguridad') {
      return await accionAlertaSeguridad(payload, res);
    }

    if (tipo === 'enviar_formulario') {
      return await accionEnviarFormulario(payload, res);
    }

    if (tipo === 'chat_ia') {
      return await accionChatIa(payload, res);
    }

    return respuestaError(res, 'Tipo de acción no reconocido');
  } catch (error) {
    console.error('Error en API pública ARCO:', error.message);

    return res.status(500).json({
      ok: false,
      error: 'Error interno en API pública ARCO',
    });
  }
}

module.exports = {
  manejarArcoPublico,
};
