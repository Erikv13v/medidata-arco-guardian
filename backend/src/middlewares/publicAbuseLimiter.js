const pool = require('../config/database');

const ventanas = new Map();

const reglas = {
  generar_pin: {
    ventanaMs: 15 * 60 * 1000,
    limite: 3,
    severidad: 'alta',
    mensaje: 'Demasiadas solicitudes de PIN. Por seguridad, espera 15 minutos antes de solicitar otro código.',
  },
  verificar_pin: {
    ventanaMs: 15 * 60 * 1000,
    limite: 6,
    severidad: 'media',
    mensaje: 'Demasiados intentos de verificación. Solicita un nuevo PIN más tarde.',
  },
  chat_ia: {
    ventanaMs: 10 * 60 * 1000,
    limite: 20,
    severidad: 'media',
    mensaje: 'Demasiadas consultas al asistente IA. Espera unos minutos antes de continuar.',
  },
  alerta_emergencia: {
    ventanaMs: 30 * 60 * 1000,
    limite: 5,
    severidad: 'alta',
    mensaje: 'Demasiadas alertas generadas desde este origen. Espera antes de reportar otra alerta.',
  },
  crear_solicitud: {
    ventanaMs: 30 * 60 * 1000,
    limite: 10,
    severidad: 'media',
    mensaje: 'Demasiadas solicitudes creadas desde este origen. Espera antes de continuar.',
  },
  consultar_estado: {
    ventanaMs: 10 * 60 * 1000,
    limite: 30,
    severidad: 'baja',
    mensaje: 'Demasiadas consultas de estado. Espera unos minutos.',
  },
};

function leerTipo(req) {
  try {
    if (typeof req.body === 'string') {
      const parsed = JSON.parse(req.body);
      return String(parsed.tipo || 'general').toLowerCase();
    }

    return String(req.body?.tipo || 'general').toLowerCase();
  } catch {
    return 'general';
  }
}

function obtenerIp(req) {
  const raw =
    req.headers['x-forwarded-for'] ||
    req.ip ||
    req.socket?.remoteAddress ||
    '';

  return String(raw)
    .split(',')[0]
    .trim()
    .replace('::ffff:', '');
}

function limpiarVentanasAntiguas() {
  const ahora = Date.now();

  for (const [clave, registro] of ventanas.entries()) {
    if (ahora > registro.expiraEn) {
      ventanas.delete(clave);
    }
  }
}

async function registrarEventoAbuso({ req, tipo, regla, registro, ip }) {
  try {
    await pool.query(
      `
      INSERT INTO medidata.eventos_seguridad (
        categoria,
        severidad,
        origen,
        ip_origen,
        descripcion,
        datos_tecnicos,
        accion_automatica
      )
      VALUES (
        $1,
        $2,
        $3,
        NULLIF($4, '')::inet,
        $5,
        $6::jsonb,
        $7
      )
      `,
      [
        'abuso_api_publica',
        regla.severidad || 'media',
        'api_publica',
        ip,
        `Rate limit activado para acción pública: ${tipo}`,
        JSON.stringify({
          tipo,
          metodo: req.method,
          ruta: req.originalUrl,
          contador: registro.contador,
          limite: regla.limite,
          ventanaMs: regla.ventanaMs,
          userAgent: req.headers['user-agent'] || null,
        }),
        regla.mensaje,
      ]
    );
  } catch (error) {
    console.error('No se pudo registrar evento de seguridad:', error.message);
  }
}

async function publicAbuseLimiter(req, res, next) {
  limpiarVentanasAntiguas();

  const tipo = leerTipo(req);
  const regla = reglas[tipo];

  if (!regla) {
    return next();
  }

  const ip = obtenerIp(req);
  const clave = `${ip}:${tipo}`;
  const ahora = Date.now();

  let registro = ventanas.get(clave);

  if (!registro || ahora > registro.expiraEn) {
    registro = {
      contador: 0,
      expiraEn: ahora + regla.ventanaMs,
    };
  }

  registro.contador += 1;
  ventanas.set(clave, registro);

  if (registro.contador > regla.limite) {
    await registrarEventoAbuso({ req, tipo, regla, registro, ip });

    return res.status(429).json({
      ok: false,
      error: regla.mensaje,
      tipo,
    });
  }

  return next();
}

module.exports = publicAbuseLimiter;
