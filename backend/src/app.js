const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const publicRoutes = require('./routes/publicRoutes');
const internalRoutes = require('./routes/internalRoutes');
const publicAbuseLimiter = require('./middlewares/publicAbuseLimiter');
const publicPayloadValidator = require('./middlewares/publicPayloadValidator');

const app = express();

app.disable('x-powered-by');
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://peppy-pegasus-b93051.netlify.app'
].join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.text({ type: 'text/plain', limit: '100kb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.status(200).json({
      estado: 'ok',
      servicio: 'MediData API',
      baseDatos: 'conectada',
      fecha: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      estado: 'error',
      servicio: 'MediData API',
      baseDatos: 'sin conexión',
    });
  }
});

app.use('/api/public', publicAbuseLimiter, publicPayloadValidator, publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/internal', internalRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Ruta no encontrada',
  });
});

app.use((error, req, res, next) => {
  const mensaje = String(error?.message || 'Error interno');

  console.error('Error controlado por middleware:', mensaje);

  if (mensaje.includes('Origen no permitido por CORS')) {
    return res.status(403).json({
      ok: false,
      error: 'Origen no autorizado',
    });
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      ok: false,
      error: 'Formato JSON inválido',
    });
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      ok: false,
      error: 'Solicitud demasiado grande',
    });
  }

  return res.status(500).json({
    ok: false,
    error: 'Error interno del servidor',
  });
});

module.exports = app;
