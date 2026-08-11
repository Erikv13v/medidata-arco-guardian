const pool = require('../config/database');

const estadosPermitidos = ['activo', 'bloqueado', 'inactivo'];

async function actualizarEstadoPersonal(req, res) {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado || !estadosPermitidos.includes(estado)) {
    return res.status(400).json({
      estado: 'error',
      mensaje: 'Estado de personal no válido',
    });
  }

  if (id === req.auth.idPersonal && estado !== 'activo') {
    return res.status(400).json({
      estado: 'error',
      mensaje: 'No puedes bloquear o inactivar tu propia cuenta',
    });
  }

  try {
    const resultado = await pool.query(
      `
      UPDATE medidata.personal_interno
      SET
        estado = $2::varchar,
        intentos_password = CASE WHEN $2::text = 'activo' THEN 0 ELSE intentos_password END,
        intentos_pin = CASE WHEN $2::text = 'activo' THEN 0 ELSE intentos_pin END,
        bloqueado_hasta = CASE WHEN $2::text = 'activo' THEN NULL ELSE bloqueado_hasta END
      WHERE id_personal = $1
      RETURNING
        id_personal,
        usuario,
        nombre,
        correo,
        estado,
        intentos_password,
        intentos_pin,
        bloqueado_hasta,
        actualizado_en
      `,
      [id, estado]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        estado: 'error',
        mensaje: 'Personal no encontrado',
      });
    }

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
      VALUES ($1, $2, 'ACTUALIZAR_ESTADO_PERSONAL', 'personal_interno', $3, 'correcto', $4, $5)
      `,
      [
        req.auth.idPersonal,
        req.auth.rol,
        id,
        `Estado de personal actualizado a: ${estado}`,
        req.ip?.replace('::ffff:', '') || null,
      ]
    );

    res.json({
      estado: 'ok',
      mensaje: 'Estado de personal actualizado correctamente',
      personal: resultado.rows[0],
    });
  } catch (error) {
    console.error('Error actualizando estado de personal:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo actualizar el estado del personal',
    });
  }
}

module.exports = {
  actualizarEstadoPersonal,
};
