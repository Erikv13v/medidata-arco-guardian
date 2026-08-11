function exigirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        estado: 'error',
        mensaje: 'Se requiere una sesión válida',
      });
    }

    if (!rolesPermitidos.includes(req.auth.rol)) {
      return res.status(403).json({
        estado: 'error',
        mensaje: 'No tienes permisos para realizar esta acción',
      });
    }

    next();
  };
}

module.exports = {
  exigirRoles,
};
