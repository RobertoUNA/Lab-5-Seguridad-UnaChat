// Servidor backend UNA Chat con Express y Socket.IO
var express = require('express');
var path = require('path');
var validation = require('./libs/unalib');

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

// Ruta raiz: servir index.html
app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para prueba de Sentry (Parte 1.2 del laboratorio)
app.get('/debug-sentry', function(req, res){
  var testError = new Error('Prueba de error controlado para Sentry - UNA Chat Vercel');
  if (Sentry) {
    Sentry.captureException(testError);
  }
  throw testError;
});

// Ruta HTTP para envio de mensajes (compatible con Supertest)
app.post('/mensaje', function(req, res){
  var payload = req.body;
  var jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  var processedMsg = validation.validarMensaje(jsonStr);

  // Emitir a todos los clientes conectados por WebSocket
  io.emit('Evento-Mensaje-Server', processedMsg);

  res.status(200).json(JSON.parse(processedMsg));
});

// Manejo de conexiones por WebSocket / Socket.IO
io.on('connection', function(socket){
  socket.on('Evento-Mensaje-Server', function(msg){
    var processedMsg = validation.validarMensaje(msg);
    // Emitir mensaje validado y saneado a todos los clientes
    io.emit('Evento-Mensaje-Server', processedMsg);
  });
});

// Middleware de captura de errores para Sentry
if (Sentry && typeof Sentry.setupExpressErrorHandler === 'function') {
  Sentry.setupExpressErrorHandler(app);
}

// Iniciar servidor solo si se ejecuta directamente
if (require.main === module) {
  http.listen(port, function(){
    console.log('listening on *:' + port);
  });
}

// Exportar app directamente como función handler para Vercel Serverless Function,
// manteniendo las propiedades app, http e io para pruebas de integración
module.exports = app;
module.exports.app = app;
module.exports.http = http;
module.exports.io = io;
