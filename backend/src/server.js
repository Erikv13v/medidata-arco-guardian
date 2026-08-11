require('dotenv').config();

const app = require('./app');
const pool = require('./config/database');

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`MediData API funcionando en http://127.0.0.1:${PORT}`);
});

async function apagarServidor() {
  console.log('\nCerrando MediData API...');

  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', apagarServidor);
process.on('SIGTERM', apagarServidor);
