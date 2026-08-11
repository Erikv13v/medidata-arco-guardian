const express = require('express');
const { autenticarSesion } = require('../middlewares/authMiddleware');
const { exigirRoles } = require('../middlewares/roleMiddleware');
const internalController = require('../controllers/internalController');
const solicitudUpdateController = require('../controllers/solicitudUpdateController');
const emergenciaUpdateController = require('../controllers/emergenciaUpdateController');
const auditoriaController = require('../controllers/auditoriaController');
const personalController = require('../controllers/personalController');
const personalEstadoController = require('../controllers/personalEstadoController');
const personalCreateController = require('../controllers/personalCreateController');
const personalPasswordController = require('../controllers/personalPasswordController');
const resumenController = require('../controllers/resumenController');

const router = express.Router();

router.get('/resumen', autenticarSesion, exigirRoles('admin', 'colaborador'), resumenController.obtenerResumen);

router.get('/auditoria', autenticarSesion, exigirRoles('admin'), auditoriaController.listarAuditoria);
router.get('/personal', autenticarSesion, exigirRoles('admin'), personalController.listarPersonal);
router.post('/personal', autenticarSesion, exigirRoles('admin'), personalCreateController.crearPersonal);
router.put('/personal/:id/estado', autenticarSesion, exigirRoles('admin'), personalEstadoController.actualizarEstadoPersonal);
router.put('/personal/:id/password', autenticarSesion, exigirRoles('admin'), personalPasswordController.actualizarPasswordPersonal);
router.get('/solicitudes', autenticarSesion, exigirRoles('admin', 'colaborador'), internalController.listarSolicitudes);
router.get('/emergencias', autenticarSesion, exigirRoles('admin', 'colaborador'), internalController.listarEmergencias);
router.put('/solicitudes/:id', autenticarSesion, exigirRoles('admin', 'colaborador'), solicitudUpdateController.actualizarSolicitud);
router.put('/emergencias/:id', autenticarSesion, exigirRoles('admin', 'colaborador'), emergenciaUpdateController.actualizarEmergencia);

router.get(
  '/admin-test',
  autenticarSesion,
  exigirRoles('admin'),
  (req, res) => {
    res.json({
      estado: 'ok',
      mensaje: 'Ruta exclusiva para administrador',
      usuario: req.auth.usuario,
      rol: req.auth.rol,
    });
  }
);

router.get(
  '/colaborador-test',
  autenticarSesion,
  exigirRoles('admin', 'colaborador'),
  (req, res) => {
    res.json({
      estado: 'ok',
      mensaje: 'Ruta permitida para administrador y colaborador',
      usuario: req.auth.usuario,
      rol: req.auth.rol,
    });
  }
);

module.exports = router;
