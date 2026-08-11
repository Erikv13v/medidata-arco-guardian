const { z } = require('zod');
const authService = require('../services/authService');

const loginSchema = z.object({
  usuario: z.string().trim().min(3).max(150),
  password: z.string().min(8).max(200),
});

async function loginInterno(req, res) {
  const validacion = loginSchema.safeParse(req.body);

  if (!validacion.success) {
    return res.status(400).json({
      estado: 'error',
      mensaje: 'Los datos enviados no son válidos',
    });
  }

  try {
    const resultado = await authService.iniciarSesionInterna({
      usuario: validacion.data.usuario,
      password: validacion.data.password,
      ipOrigen: req.ip?.replace('::ffff:', '') || null,
      userAgent: req.get('user-agent')?.slice(0, 500) || null,
    });

    return res.status(200).json({
      estado: 'ok',
      mensaje: 'Inicio de sesión correcto',
      ...resultado,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      estado: 'error',
      mensaje: error.status
        ? error.message
        : 'Ocurrió un error interno durante el inicio de sesión',
    });
  }
}

module.exports = {
  loginInterno,
};
