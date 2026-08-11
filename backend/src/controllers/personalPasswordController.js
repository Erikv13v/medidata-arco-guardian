const argon2 = require('argon2');
const pool = require('../config/database');

async function actualizarPasswordPersonal(req, res) {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({
      estado: 'error',
      mensaje: 'La nueva contraseña debe tener mínimo 8 caracteres',
    });
  }

  try {
    const passwordHash = await argon2.hash(password);

    const resultado = await pool.query(
      `
      UPDATE medidata.personal_interno
      SET
        password_hash = $2,
        intentos_password = 0,
        bloqueado_hasta = NULL
      WHERE id_personal = $1
      RETURNING
        id_personal,
        usuario,
        nombre,
        correo,
        estado,
        actualizado_en
      `,
      [id, passwordHash]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        estado: 'error',
        mensaje: 'Personal no encontrado',
      });
    }

    const personalActualizado = resultado.rows[0];

    await pool.query(
      `
      UPDATE medidata.sesiones
      SET revocada_en = now()
      WHERE id_personal = $1
        AND revocada_en IS NULL
      `,
      [id]
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
      VALUES ($1, $2, 'CAMBIAR_PASSWORD_PERSONAL', 'personal_interno', $3, 'correcto', $4, $5)
      `,
      [
        req.auth.idPersonal,
        req.auth.rol,
        id,
        `Contraseña actualizada para: ${personalActualizado.usuario}`,
        req.ip?.replace('::ffff:', '') || null,
      ]
    );

    res.json({
      estado: 'ok',
      mensaje: 'Contraseña de personal actualizada correctamente',
      personal: personalActualizado,
    });
  } catch (error) {
    console.error('Error actualizando contraseña de personal:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo actualizar la contraseña del personal',
    });
  }
}

module.exports = {
  actualizarPasswordPersonal,
};
