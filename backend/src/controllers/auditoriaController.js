const pool = require('../config/database');

async function listarAuditoria(req, res) {
  try {
    const resultado = await pool.query(
      `
      SELECT
        a.id_auditoria,
        a.id_personal,
        p.usuario,
        p.nombre,
        a.rol_utilizado,
        a.accion,
        a.entidad,
        a.registro_id,
        a.resultado,
        a.detalle,
        a.ip_origen,
        a.creado_en
      FROM medidata.auditoria_interna a
      LEFT JOIN medidata.personal_interno p
        ON p.id_personal = a.id_personal
      ORDER BY a.creado_en DESC
      LIMIT 100
      `
    );

    res.json({
      estado: 'ok',
      total: resultado.rowCount,
      auditoria: resultado.rows,
    });
  } catch (error) {
    console.error('Error listando auditoría:', error.message);

    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo listar la auditoría interna',
    });
  }
}

module.exports = {
  listarAuditoria,
};
