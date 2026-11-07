// Servidor backend UNA Chat con Express, Socket.IO y autenticacion Auth0
require('dotenv').config();
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var path = require('path');
var validation = require('./libs/unalib');
var vault = require('./server/vault');

// Integracion de Sentry (Parte 1.2 del Laboratorio)
var Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL ? 'vercel' : (process.env.NODE_ENV || 'local'),
      tracesSampleRate: 1.0,
    });
    console.log('Sentry inicializado correctamente.');
  } catch (e) {
    console.warn('Advertencia: No se pudo cargar @sentry/node:', e.message);
  }
}

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

// Middleware para parsear cuerpos JSON y urlencoded en peticiones HTTP
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configuracion de sesion para autenticacion
app.use(session({
  secret: process.env.SESSION_SECRET || 'unachat_super_secret_session_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' && !process.env.APP_BASE_URL?.startsWith('http://localhost'),
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Helper para obtener URL base
function getBaseUrl(req) {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/+$/, '');
  }
  var protocol = req ? (req.headers['x-forwarded-proto'] || req.protocol) : 'http';
  var host = req ? (req.headers['x-forwarded-host'] || req.get('host')) : `localhost:${port}`;
  return `${protocol}://${host}`;
}

// -----------------------------------------------------------------------------
// Rutas de Auth0
// -----------------------------------------------------------------------------

// GET /auth/config: responde 200 con enabled en true, el dominio y el Client ID. El secreto queda fuera.
app.get('/auth/config', function(req, res) {
  res.status(200).json({
    enabled: Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID),
    domain: process.env.AUTH0_DOMAIN || '',
    clientId: process.env.AUTH0_CLIENT_ID || ''
  });
});

// GET /auth/login: redirige al dominio de Auth0 (302)
app.get('/auth/login', function(req, res) {
  var domain = process.env.AUTH0_DOMAIN;
  var clientId = process.env.AUTH0_CLIENT_ID;

  if (!domain || !clientId) {
    return res.status(500).send('Auth0 no esta configurado en las variables de entorno.');
  }

  var baseUrl = getBaseUrl(req);
  var redirectUri = `${baseUrl}/auth/callback`;
  var state = Math.random().toString(36).substring(2, 15);
  req.session.authState = state;

  var authUrl = `https://${domain}/authorize?` + new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state: state
  }).toString();

  res.redirect(302, authUrl);
});

// GET /auth/callback: recibe codigo de Auth0, intercambia por token y guarda sesion
app.get('/auth/callback', async function(req, res) {
  var code = req.query.code;
  if (!code) {
    return res.status(400).send('Codigo de autorizacion no proporcionado por Auth0.');
  }

  var domain = process.env.AUTH0_DOMAIN;
  var clientId = process.env.AUTH0_CLIENT_ID;
  var baseUrl = getBaseUrl(req);
  var redirectUri = `${baseUrl}/auth/callback`;

  try {
    var clientSecret = await vault.getAuth0ClientSecret();
    if (!clientSecret) {
      console.error('Error: Client Secret no disponible ni en Vault ni en entorno.');
      return res.status(500).send('Error interno: Client Secret no configurado.');
    }

    // Intercambiar codigo por token (Client Secret Post)
    var tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri
    });

    var tokenResponse = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    var tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Fallo en el intercambio de token con Auth0:', tokenData);
      return res.status(401).send(`Error de autenticacion: ${tokenData.error_description || tokenData.error || 'Token invalido'}`);
    }

    // Obtener informacion del usuario autenticado
    var userInfoResponse = await fetch(`https://${domain}/userinfo`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    var profile = await userInfoResponse.json();

    req.session.user = {
      id: profile.sub,
      name: profile.name || profile.nickname || profile.email || 'Usuario',
      email: profile.email || ''
    };

    res.redirect('/sala');
  } catch (err) {
    console.error('Error en /auth/callback:', err);
    res.status(500).send('Error interno procesando callback de autenticacion.');
  }
});

// GET /auth/me: devuelve los datos de la sesion actual
app.get('/auth/me', function(req, res) {
  if (req.session && req.session.user) {
    res.status(200).json(req.session.user);
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
});

// GET /auth/logout: destruye sesion y redirige a Auth0 logout
app.get('/auth/logout', function(req, res) {
  var domain = process.env.AUTH0_DOMAIN;
  var clientId = process.env.AUTH0_CLIENT_ID;
  var baseUrl = getBaseUrl(req);

  req.session.destroy(function(err) {
    if (err) {
      console.warn('Error al destruir sesion:', err);
    }
    res.clearCookie('connect.sid');

    if (domain && clientId) {
      var logoutUrl = `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(baseUrl)}`;
      res.redirect(logoutUrl);
    } else {
      res.redirect('/');
    }
  });
});

// -----------------------------------------------------------------------------
// Rutas de la aplicacion
// -----------------------------------------------------------------------------

// GET /sala: debe responder 401 y pedir iniciar sesion si no hay cookie de sesion
app.get('/sala', function(req, res) {
  if (!req.session || !req.session.user) {
    return res.status(401).send('401 No autorizado. Inicie sesion primero en /auth/login');
  }
  res.sendFile(path.join(__dirname, 'sala.html'));
});

// Ruta raiz: servir index.html (mantiene compatibilidad con tests E2E y flujo basico)
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para prueba de Sentry (Parte 1.2 del laboratorio)
app.get('/debug-sentry', function(req, res) {
  var testError = new Error('Prueba de error controlado para Sentry - UNA Chat Vercel');
  if (Sentry) {
    Sentry.captureException(testError);
  }
  throw testError;
});

// Ruta HTTP para envio de mensajes (compatible con Supertest)
app.post('/mensaje', function(req, res) {
  var payload = req.body;
  var jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  var processedMsg = validation.validarMensaje(jsonStr);

  // Emitir a todos los clientes conectados por WebSocket
  io.emit('Evento-Mensaje-Server', processedMsg);

  res.status(200).json(JSON.parse(processedMsg));
});

// Manejo de conexiones por WebSocket / Socket.IO
io.on('connection', function(socket) {
  socket.on('Evento-Mensaje-Server', function(msg) {
    var processedMsg = validation.validarMensaje(msg);
    // Emitir mensaje validado y saneado a todos los clientes
    io.emit('Evento-Mensaje-Server', processedMsg);
  });
});

// Middleware de captura de errores para Sentry
if (Sentry && typeof Sentry.setupExpressErrorHandler === 'function') {
  Sentry.setupExpressErrorHandler(app);
}

// -----------------------------------------------------------------------------
// Prueba de arranque (Startup probe contra Auth0)
// -----------------------------------------------------------------------------
async function runAuth0StartupProbe() {
  var domain = process.env.AUTH0_DOMAIN;
  var clientId = process.env.AUTH0_CLIENT_ID;

  if (!domain || !clientId) {
    console.log('[Auth0 Probe] AUTH0_DOMAIN o AUTH0_CLIENT_ID no estan configurados. Omitiendo prueba de sondeo.');
    return;
  }

  try {
    var secret = await vault.getAuth0ClientSecret();
    if (!secret) {
      console.warn('[Auth0 Probe] Advertencia: No se encontro el Client Secret (ni en Vault ni en .env).');
      return;
    }

    var baseUrl = getBaseUrl();
    var probeParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: secret,
      code: 'vault-startup-probe',
      redirect_uri: `${baseUrl}/auth/callback`,
      code_verifier: 'a'.repeat(43)
    });

    var response = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: probeParams.toString()
    });

    var data = await response.json();

    if (data.error === 'invalid_grant') {
      console.log('[Auth0 Probe] Resultado esperado en arranque: invalid_grant. El Client Secret fue validado exitosamente por Auth0.');
    } else if (data.error === 'invalid_client') {
      console.error('[Auth0 Probe] ERROR: invalid_client. El Client Secret proporcionado no coincide con la aplicacion en Auth0.');
    } else {
      console.log(`[Auth0 Probe] Respuesta de Auth0: ${data.error || response.status} (${data.error_description || ''})`);
    }
  } catch (probeErr) {
    console.warn('[Auth0 Probe] Error al ejecutar la prueba de arranque:', probeErr.message);
  }
}

// Iniciar servidor solo si se ejecuta directamente
if (require.main === module) {
  http.listen(port, async function() {
    console.log('listening on *:' + port);
    await runAuth0StartupProbe();
  });
}

// Exportar app directamente como función handler para Vercel Serverless Function,
// manteniendo las propiedades app, http e io para pruebas de integración
module.exports = app;
module.exports.app = app;
module.exports.http = http;
module.exports.io = io;
