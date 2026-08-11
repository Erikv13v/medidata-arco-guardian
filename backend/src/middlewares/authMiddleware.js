const crypto = require('crypto');
const pool = require('../config/database');

function crearHashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

async function autenticarSesion(req, res, next) {
  try {
    const encabezado = req.get('authorization') || '';
    const token = encabezado.startsWith('Bearer ')
      ? encabezado.slice(7).trim()
      : '';

    if (!/^[0-9a-f]{64}$/.test(token)) {
      return res.status(401).json({
        estado: 'error',
        mensaje: 'Se requiere una sesión válida',
      });
    }

    const tokenHash = crearHashToken(token);

    const consulta = await pool.query(
      `
      SELECT
        s.id_sesion,
        s.id_personal,
        s.expira_en,
        p.usuario,
        p.nombre,
        p.correo,
        p.estado,
        r.nombre AS rol,
        r.permisos
      FROM medidata.sesiones s
      JOIN medidata.personal_interno p
        ON p.id_personal = s.id_personal
      JOIN medidata.roles r
        ON r.id_rol = p.id_rol
      WHERE s.token_hash = $1
        AND s.revocada_en IS NULL
        AND s.expira_en > now()
        AND p.estado = 'activo'
      `,
      [tokenHash]
    );

    if (consulta.rowCount === 0) {
      return res.status(401).json({
        estado: 'error',
        mensaje: 'La sesión no existe o ha expirado',
      });
    }

    const sesion = consulta.rows[0];

    await pool.query(
      `
      UPDATE medidata.sesiones
      SET ultima_actividad = now()
      WHERE id_sesion = $1
      `,
      [sesion.id_sesion]
    );

    req.auth = {
      idSesion: sesion.id_sesion,
      idPersonal: sesion.id_personal,
      usuario: sesion.usuario,
      nombre: sesion.nombre,
      correo: sesion.correo,
      rol: sesion.rol,
      permisos: sesion.permisos,
      expiraEn: sesion.expira_en,
    };

    next();
  } catch (error) {
    console.error('Error validando sesión:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo validar la sesión',
    });
  }
}

module.exports = {
  autenticarSesion,
};
