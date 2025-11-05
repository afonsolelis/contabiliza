const path = require('path');
const express = require('express');
const bodyParser = require('express').urlencoded;
require('dotenv').config();

const { router: tagsRouter } = require('./src/controllers/tagsController');
const { router: gastosRouter } = require('./src/controllers/gastosController');
const { router: dashboardRouter } = require('./src/controllers/dashboardController');
const { router: contasRouter } = require('./src/controllers/contasController');
const { runMigrations } = require('./src/db/migrate');

const app = express();

// Basic Auth via .env (AUTH_USER / AUTH_PASSWORD)
const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
if (!AUTH_USER || !AUTH_PASSWORD) {
  // eslint-disable-next-line no-console
  console.error('Missing AUTH_USER or AUTH_PASSWORD env vars. Define them in your .env file.');
  process.exit(1);
}

function basicAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Basic ')) {
    const base64 = authHeader.slice(6);
    let decoded = '';
    try {
      decoded = Buffer.from(base64, 'base64').toString('utf8');
    } catch (_) {
      // ignore
    }
    const sepIndex = decoded.indexOf(':');
    const user = sepIndex >= 0 ? decoded.slice(0, sepIndex) : '';
    const pass = sepIndex >= 0 ? decoded.slice(sepIndex + 1) : '';
    if (user === AUTH_USER && pass === AUTH_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Contabiliza"');
  return res.status(401).send('Authentication required');
}

app.use(basicAuthMiddleware);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser({ extended: true }));

app.get('/', (req, res) => res.redirect('/dashboard'));
app.use('/tags', tagsRouter);
app.use('/gastos', gastosRouter);
app.use('/dashboard', dashboardRouter);
app.use('/contas', contasRouter);

const port = process.env.PORT || 3000;

// Executa migrações antes de subir o servidor
runMigrations()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Servidor iniciado em http://localhost:${port}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Falha ao executar migrações:', err);
    process.exit(1);
  });

