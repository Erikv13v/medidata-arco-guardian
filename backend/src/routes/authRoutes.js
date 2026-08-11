const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const logoutController = require('../controllers/logoutController');
const { autenticarSesion } = require('../middlewares/authMiddleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    estado: 'error',
    mensaje: 'Demasiados intentos. Intenta nuevamente más tarde',
  },
});

router.post('/login-interno', loginLimiter, authController.loginInterno);
router.post('/logout-interno', autenticarSesion, logoutController.cerrarSesionInterna);

router.get('/me', autenticarSesion, (req, res) => {
  res.status(200).json({
    estado: 'ok',
    mensaje: 'Sesión válida',
    personal: req.auth,
  });
});

module.exports = router;
