const pool = require('../config/database');

async function listarSolicitudes(req, res) {
  try {
    const resultado = await pool.query(
      `
      SELECT
        id_solicitud,
        ticket,
        nombre_titular,
        correo,
        telefono,
        tipo_solicitud,
        estado,
        responsable,
        canal,
        creado_en,
        actualizado_en
      FROM medidata.vw_solicitudes_internas
      ORDER BY creado_en DESC
      LIMIT 50
      `
    );

    res.json({
      estado: 'ok',
      total: resultado.rowCount,
      solicitudes: resultado.rows,
    });
  } catch (error) {
    console.error('Error listando solicitudes:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudieron listar las solicitudes',
    });
  }
}


async function listarEmergencias(req, res) {
  try {
    const resultado = await pool.query(
      `
      SELECT
        id_alerta,
        ticket,
        nombre_titular,
        correo,
        telefono,
        nivel_riesgo,
        tipo_caso,
        estado,
        responsable,
        creado_en,
        actualizado_en
      FROM medidata.vw_emergencias_internas
      ORDER BY creado_en DESC
      LIMIT 50
      `
    );

    res.json({
      estado: 'ok',
      total: resultado.rowCount,
      emergencias: resultado.rows,
    });
  } catch (error) {
    console.error('Error listando emergencias:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudieron listar las emergencias',
    });
  }
}

module.exports = {
  listarSolicitudes,
  listarEmergencias,
};
