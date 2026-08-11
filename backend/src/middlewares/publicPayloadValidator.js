const tiposPermitidos = new Set([
  'buscar_usuario',
  'crear_usuario',
  'generar_pin',
  'verificar_pin',
  'crear_solicitud',
  'alerta_emergencia',
  'consultar_estado',
  'alerta_seguridad',
  'enviar_formulario',
  'chat_ia',
]);

function respuesta(res, status, mensaje) {
  return res.status(status).json({
    ok: false,
    error: mensaje,
  });
}

function leerPayload(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  return null;
}

function texto(valor) {
  return String(valor || '').trim();
}

function validarLongitud(valor, maximo) {
  return texto(valor).length <= maximo;
}

function tieneTexto(payload, campos) {
  return campos.some((campo) => texto(payload[campo]).length > 0);
}

function publicPayloadValidator(req, res, next) {
  try {
    if (req.method === 'GET') {
      return next();
    }

    const payload = leerPayload(req);

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return respuesta(res, 400, 'Solicitud inválida');
    }

    req.body = payload;

    const tipo = texto(payload.tipo).toLowerCase();

    if (!tipo) {
      return respuesta(res, 400, 'Tipo de acción requerido');
    }

    if (!tiposPermitidos.has(tipo)) {
      return respuesta(res, 400, 'Tipo de acción no permitido');
    }

    if (!validarLongitud(payload.api_key, 120)) {
      return respuesta(res, 400, 'Solicitud inválida');
    }

    if (!validarLongitud(payload.correo, 160)) {
      return respuesta(res, 400, 'Correo inválido');
    }

    if (!validarLongitud(payload.cedula, 30)) {
      return respuesta(res, 400, 'Identificación inválida');
    }

    if (!validarLongitud(payload.telefono, 30)) {
      return respuesta(res, 400, 'Teléfono inválido');
    }

    if (!validarLongitud(payload.nombre, 160)) {
      return respuesta(res, 400, 'Nombre inválido');
    }

    if (!validarLongitud(payload.mensaje || payload.texto || payload.pregunta, 1000)) {
      return respuesta(res, 400, 'Mensaje demasiado largo');
    }

    if (!validarLongitud(payload.observacion || payload.descripcion || payload.detalle || payload.resumen || payload.relato || payload.evidencia, 4000)) {
      return respuesta(res, 400, 'Descripción demasiado larga');
    }

    if (tipo === 'generar_pin') {
      if (!tieneTexto(payload, ['cedula', 'correo']) || !texto(payload.password)) {
        return respuesta(res, 400, 'Datos incompletos para generar PIN');
      }
    }

    if (tipo === 'verificar_pin') {
      if (!tieneTexto(payload, ['cedula', 'correo']) || !/^\d{6}$/.test(texto(payload.pin))) {
        return respuesta(res, 400, 'PIN inválido');
      }
    }

    if (tipo === 'chat_ia') {
      if (!tieneTexto(payload, ['mensaje', 'texto', 'pregunta'])) {
        return respuesta(res, 400, 'Mensaje requerido para el asistente IA');
      }
    }

    if (tipo === 'alerta_emergencia') {
      if (!tieneTexto(payload, ['observacion', 'descripcion', 'detalle', 'resumen', 'relato', 'evidencia'])) {
        return respuesta(res, 400, 'Descripción requerida para generar alerta');
      }
    }

    return next();
  } catch {
    return respuesta(res, 400, 'Formato de solicitud inválido');
  }
}

module.exports = publicPayloadValidator;
