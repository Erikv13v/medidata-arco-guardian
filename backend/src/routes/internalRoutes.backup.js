const express = require('express');
const { autenticarSesion } = require('../middlewares/authMiddleware');
const { exigirRoles } = require('../middlewares/roleMiddleware');
const internalController = require('../controllers/internalController');

const router = express.Router();
router.get('/solicitudes', autenticarSesion, exigirRoles('admin', 'colaborador'), internalController.listarSolicitudes);
router.get('/emergencias', autenticarSesion, exigirRoles('admin', 'colaborador'), internalController.listarEmergencias);

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
