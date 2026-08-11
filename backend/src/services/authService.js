const argon2 = require('argon2');
const crypto = require('crypto');
const pool = require('../config/database');

function crearError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function registrarIntento(client, {
  idPersonal = null,
  usuario,
  resultado,
  motivo,
  ipOrigen,
  userAgent,
}) {
  await client.query(
    `
    INSERT INTO medidata.intentos_acceso (
      id_personal,
      usuario_ingresado,
      tipo_intento,
      resultado,
      motivo,
      ip_origen,
      user_agent
    )
    VALUES ($1, $2, 'PASSWORD', $3, $4, $5, $6)
    `,
    [idPersonal, usuario, resultado, motivo, ipOrigen, userAgent]
  );
}

async function iniciarSesionInterna({
  usuario,
  password,
  ipOrigen,
  userAgent,
}) {
  const client = await pool.connect();
  let transaccionAbierta = false;

  try {
    await client.query('BEGIN');
    transaccionAbierta = true;

    const consulta = await client.query(
      `
      SELECT
        p.id_personal,
        p.usuario,
        p.nombre,
        p.correo,
        p.password_hash,
        p.estado,
        p.intentos_password,
        p.bloqueado_hasta,
        r.nombre AS rol,
        r.permisos
      FROM medidata.personal_interno p
      JOIN medidata.roles r ON r.id_rol = p.id_rol
      WHERE p.usuario = $1
      FOR UPDATE OF p
      `,
      [usuario]
    );

    if (consulta.rowCount === 0) {
      await registrarIntento(client, {
        usuario,
        resultado: 'fallido',
        motivo: 'Credenciales incorrectas',
        ipOrigen,
        userAgent,
      });

      await client.query('COMMIT');
      transaccionAbierta = false;
      throw crearError(401, 'Usuario o contraseña incorrectos');
    }

    const personal = consulta.rows[0];

    if (personal.estado === 'inactivo') {
      await registrarIntento(client, {
        idPersonal: personal.id_personal,
        usuario,
        resultado: 'rechazado',
        motivo: 'Cuenta inactiva',
        ipOrigen,
        userAgent,
      });

      await client.query('COMMIT');
      transaccionAbierta = false;
      throw crearError(403, 'La cuenta se encuentra inactiva');
    }

    const ahora = new Date();
    const bloqueoVigente =
      personal.estado === 'bloqueado' &&
      (!personal.bloqueado_hasta ||
        new Date(personal.bloqueado_hasta) > ahora);

    if (bloqueoVigente) {
      await registrarIntento(client, {
        idPersonal: personal.id_personal,
        usuario,
        resultado: 'bloqueado',
        motivo: 'Bloqueo temporal vigente',
        ipOrigen,
        userAgent,
      });

      await client.query('COMMIT');
      transaccionAbierta = false;
      throw crearError(423, 'Cuenta bloqueada temporalmente');
    }

    const passwordCorrecta = await argon2.verify(
      personal.password_hash,
      password
    );

    if (!passwordCorrecta) {
      const nuevosIntentos = Number(personal.intentos_password) + 1;
      const debeBloquearse = nuevosIntentos >= 5;

      await client.query(
        `
        UPDATE medidata.personal_interno
        SET
          intentos_password = $2,
          estado = CASE WHEN $3 THEN 'bloqueado' ELSE estado END,
          bloqueado_hasta = CASE
            WHEN $3 THEN now() + interval '15 minutes'
            ELSE bloqueado_hasta
          END
        WHERE id_personal = $1
        `,
        [personal.id_personal, nuevosIntentos, debeBloquearse]
      );

      await registrarIntento(client, {
        idPersonal: personal.id_personal,
        usuario,
        resultado: debeBloquearse ? 'bloqueado' : 'fallido',
        motivo: debeBloquearse
          ? 'Cuenta bloqueada después de cinco intentos'
          : 'Credenciales incorrectas',
        ipOrigen,
        userAgent,
      });

      await client.query('COMMIT');
      transaccionAbierta = false;

      throw crearError(
        debeBloquearse ? 423 : 401,
        debeBloquearse
          ? 'Cuenta bloqueada temporalmente'
          : 'Usuario o contraseña incorrectos'
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    await client.query(
      `
      UPDATE medidata.personal_interno
      SET
        intentos_password = 0,
        bloqueado_hasta = NULL,
        estado = 'activo',
        ultimo_acceso = now()
      WHERE id_personal = $1
      `,
      [personal.id_personal]
    );

    const sesion = await client.query(
      `
      INSERT INTO medidata.sesiones (
        id_personal,
        token_hash,
        ip_origen,
        user_agent,
        expira_en
      )
      VALUES ($1, $2, $3, $4, now() + interval '8 hours')
      RETURNING id_sesion, expira_en
      `,
      [personal.id_personal, tokenHash, ipOrigen, userAgent]
    );

    await registrarIntento(client, {
      idPersonal: personal.id_personal,
      usuario,
      resultado: 'correcto',
      motivo: 'Inicio de sesión correcto',
      ipOrigen,
      userAgent,
    });

    await client.query(
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
      VALUES ($1, $2, 'INICIAR_SESION', 'sesiones', $3, 'correcto',
              'Inicio de sesión interno', $4)
      `,
      [
        personal.id_personal,
        personal.rol,
        sesion.rows[0].id_sesion,
        ipOrigen,
      ]
    );

    await client.query('COMMIT');
    transaccionAbierta = false;

    return {
      token,
      expiraEn: sesion.rows[0].expira_en,
      personal: {
        id: personal.id_personal,
        usuario: personal.usuario,
        nombre: personal.nombre,
        correo: personal.correo,
        rol: personal.rol,
        permisos: personal.permisos,
      },
    };
  } catch (error) {
    if (transaccionAbierta) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  iniciarSesionInterna,
};
