const pool = require('../config/database');

const estadosPermitidos = [
  'Pendiente',
  'Pendiente de revisión',
  'En revisión',
  'Avanzado',
  'Culminado',
  'Derivado',
  'Rechazado',
];

async function actualizarEmergencia(req, res) {
  const { id } = req.params;
  const { estado, observacion, idResponsable } = req.body;

  if (!estado || !estadosPermitidos.includes(estado)) {
    return res.status(400).json({
      estado: 'error',
      mensaje: 'Estado de emergencia no válido',
    });
  }

  try {
    const resultado = await pool.query(
      `
      UPDATE medidata.alertas_emergencia
      SET
        estado = $2::varchar,
        observacion = COALESCE($3::text, observacion),
        id_responsable = COALESCE($4::uuid, id_responsable),
        cerrado_en = CASE
          WHEN $2::text IN ('Culminado', 'Rechazado') THEN now()
          ELSE cerrado_en
        END
      WHERE id_alerta = $1
      RETURNING
        id_alerta,
        ticket,
        nivel_riesgo,
        tipo_caso,
        estado,
        observacion,
        id_responsable,
        actualizado_en,
        cerrado_en
      `,
      [id, estado, observacion || null, idResponsable || null]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        estado: 'error',
        mensaje: 'Emergencia no encontrada',
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
      VALUES ($1, $2, 'ACTUALIZAR_EMERGENCIA', 'alertas_emergencia', $3, 'correcto', $4, $5)
      `,
      [
        req.auth.idPersonal,
        req.auth.rol,
        id,
        `Emergencia actualizada a estado: ${estado}`,
        req.ip?.replace('::ffff:', '') || null,
      ]
    );

    res.json({
      estado: 'ok',
      mensaje: 'Emergencia actualizada correctamente',
      emergencia: resultado.rows[0],
    });
  } catch (error) {
    console.error('Error actualizando emergencia:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo actualizar la emergencia',
    });
  }
}

module.exports = {
  actualizarEmergencia,
};
