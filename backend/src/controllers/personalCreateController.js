const argon2 = require('argon2');
const pool = require('../config/database');

const rolesPermitidos = ['admin', 'colaborador'];

async function crearPersonal(req, res) {
  const { usuario, nombre, correo, password, rol } = req.body;

  if (!usuario || !nombre || !correo || !password || !rol) {
    return res.status(400).json({
      estado: 'error',
      mensaje: 'Faltan datos obligatorios',
    });
  }

  if (!rolesPermitidos.includes(rol)) {
    return res.status(400).json({
      estado: 'error',
      mensaje: 'Rol no válido',
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      estado: 'error',
      mensaje: 'La contraseña debe tener mínimo 8 caracteres',
    });
  }

  try {
    const rolResultado = await pool.query(
      `
      SELECT id_rol, nombre
      FROM medidata.roles
      WHERE nombre = $1
      `,
      [rol]
    );

    if (rolResultado.rowCount === 0) {
      return res.status(400).json({
        estado: 'error',
        mensaje: 'El rol indicado no existe',
      });
    }

    const passwordHash = await argon2.hash(password);

    const resultado = await pool.query(
      `
      INSERT INTO medidata.personal_interno (
        usuario,
        nombre,
        correo,
        password_hash,
        id_rol,
        estado
      )
      VALUES ($1, $2, $3, $4, $5, 'activo')
      RETURNING
        id_personal,
        usuario,
        nombre,
        correo,
        id_rol,
        estado,
        creado_en,
        actualizado_en
      `,
      [
        usuario.trim(),
        nombre.trim(),
        correo.trim().toLowerCase(),
        passwordHash,
        rolResultado.rows[0].id_rol,
      ]
    );

    const personalCreado = resultado.rows[0];

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
      VALUES ($1, $2, 'CREAR_PERSONAL', 'personal_interno', $3, 'correcto', $4, $5)
      `,
      [
        req.auth.idPersonal,
        req.auth.rol,
        personalCreado.id_personal,
        `Personal creado: ${usuario.trim()} con rol ${rol}`,
        req.ip?.replace('::ffff:', '') || null,
      ]
    );

    res.status(201).json({
      estado: 'ok',
      mensaje: 'Personal interno creado correctamente',
      personal: personalCreado,
    });
  } catch (error) {
    console.error('Error creando personal:', error.message);

    if (error.code === '23505') {
      return res.status(409).json({
        estado: 'error',
        mensaje: 'El usuario o correo ya existe',
      });
    }

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo crear el personal interno',
    });
  }
}

module.exports = {
  crearPersonal,
};
