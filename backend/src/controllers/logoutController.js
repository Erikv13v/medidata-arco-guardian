const pool = require('../config/database');

async function cerrarSesionInterna(req, res) {
  try {
    await pool.query(
      `
      UPDATE medidata.sesiones
      SET revocada_en = now()
      WHERE id_sesion = $1
      `,
      [req.auth.idSesion]
    );

    await pool.query(
      `
      INSERT INTO medidata.auditoria_interna (
        id_personal,
        rol_utilizado,
        accion,
        entidad,
        registro_id,
        resultado,
        detalle,
        ip_origen
      )
      VALUES ($1, $2, 'CERRAR_SESION', 'sesiones', $3, 'correcto', 'Cierre de sesión interno', $4)
      `,
      [
        req.auth.idPersonal,
        req.auth.rol,
        req.auth.idSesion,
        req.ip?.replace('::ffff:', '') || null,
      ]
    );

    res.json({
      estado: 'ok',
      mensaje: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    console.error('Error cerrando sesión:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo cerrar la sesión',
    });
  }
}

module.exports = {
  cerrarSesionInterna,
};
