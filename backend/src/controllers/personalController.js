const pool = require('../config/database');

async function listarPersonal(req, res) {
  try {
    const resultado = await pool.query(
      `
      SELECT
        p.id_personal,
        p.usuario,
        p.nombre,
        p.correo,
        r.nombre AS rol,
        p.estado,
        p.intentos_password,
        p.intentos_pin,
        p.bloqueado_hasta,
        p.ultimo_acceso,
        p.creado_en,
        p.actualizado_en
      FROM medidata.personal_interno p
      JOIN medidata.roles r
        ON r.id_rol = p.id_rol
      ORDER BY p.creado_en DESC
      LIMIT 100
      `
    );

    res.json({
      estado: 'ok',
      total: resultado.rowCount,
      personal: resultado.rows,
    });
  } catch (error) {
    console.error('Error listando personal:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo listar el personal interno',
    });
  }
}

module.exports = {
  listarPersonal,
};
