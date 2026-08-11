const pool = require('../config/database');

async function obtenerResumen(req, res) {
  try {
    const resultado = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM medidata.usuarios) AS usuarios,
        (SELECT COUNT(*) FROM medidata.personal_interno) AS personal,
        (SELECT COUNT(*) FROM medidata.solicitudes WHERE estado NOT IN ('Culminado', 'Rechazado')) AS solicitudes_abiertas,
        (SELECT COUNT(*) FROM medidata.alertas_emergencia WHERE estado NOT IN ('Culminado', 'Rechazado')) AS emergencias_abiertas,
        (SELECT COUNT(*) FROM medidata.auditoria_interna) AS auditorias
      `
    );

    const resumen = resultado.rows[0];

    res.json({
      estado: 'ok',
      resumen: {
        usuarios: Number(resumen.usuarios),
        personal: Number(resumen.personal),
        solicitudesAbiertas: Number(resumen.solicitudes_abiertas),
        emergenciasAbiertas: Number(resumen.emergencias_abiertas),
        auditorias: Number(resumen.auditorias),
      },
    });
  } catch (error) {
    console.error('Error obteniendo resumen:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo obtener el resumen del sistema',
    });
  }
}

module.exports = {
  obtenerResumen,
};
