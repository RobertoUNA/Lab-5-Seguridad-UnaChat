// Servidor backend UNA Chat con Express y Socket.IO
var express = require('express');
var validation = require('./libs/unalib');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

// Middleware para parsear cuerpos JSON y urlencoded en peticiones HTTP
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta raiz: servir index.html
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
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

// Iniciar servidor solo si se ejecuta directamente
if (require.main === module) {
  http.listen(port, function(){
    console.log('listening on *:' + port);
  });
}

module.exports = { app: app, http: http, io: io };
