var request = require('supertest');
var ioClient = require('socket.io-client');
var serverModule = require('../../server');
var validation = require('../../libs/unalib');

var app = serverModule.app;
var http = serverModule.http;

describe('Pruebas de Integracion: Backend Node.js + una-lib (UNA Chat)', function() {
  var serverInstance;
  var serverPort;
  var socketUrl;

  beforeAll(function(done) {
    // Iniciar servidor HTTP en un puerto aleatorio para pruebas
    serverInstance = http.listen(0, function() {
      serverPort = serverInstance.address().port;
      socketUrl = 'http://localhost:' + serverPort;
      done();
    });
  });

  afterAll(function(done) {
    if (serverInstance) {
      serverInstance.close(done);
    } else {
      done();
    }
  });

  describe('Integracion HTTP con Supertest (POST /mensaje)', function() {

    it('1. URL de imagen valida: el backend acepta el mensaje y genera tag <img>', async function() {
      var payload = {
        nombre: 'Carlos',
        mensaje: 'https://imagenes.com/foto.jpg',
        color: '#ff5733'
      };

      var res = await request(app)
        .post('/mensaje')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body.nombre).toBe('Carlos');
      expect(res.body.mensaje).toContain('<img src="https://imagenes.com/foto.jpg"');
    });

    it('2. URL de video valida: el backend acepta el mensaje y genera tag <iframe> embebido', async function() {
      var payload = {
        nombre: 'Maria',
        mensaje: 'https://www.youtube.com/watch?v=qYwlqx-JLok',
        color: '#33ff57'
      };

      var res = await request(app)
        .post('/mensaje')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body.nombre).toBe('Maria');
      expect(res.body.mensaje).toContain('<iframe');
      expect(res.body.mensaje).toContain('https://www.youtube.com/embed/qYwlqx-JLok');
    });

    it('3. URL no permitida o script malicioso: la validacion devuelve contenido saneado', async function() {
      var payload = {
        nombre: 'Hacker',
        mensaje: "<script>alert('Inyección de script');</script>",
        color: '#3357ff'
      };

      var res = await request(app)
        .post('/mensaje')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(200);

      // Comprobar que no contiene tags ejecutables <script> y que fue debidamente saneado
      expect(res.body.mensaje).not.toContain('<script>');
      expect(res.body.mensaje).toContain('&lt;script&gt;');
      expect(res.body.mensaje).toContain('&lt;/script&gt;');
    });

    it('4. Comprobar que el backend llama realmente a validarMensaje de una-lib', async function() {
      var spyValidar = jest.spyOn(validation, 'validarMensaje');

      var payload = {
        nombre: 'UsuarioPrueba',
        mensaje: 'Mensaje de verificacion espia',
        color: '#123456'
      };

      await request(app)
        .post('/mensaje')
        .send(payload)
        .expect(200);

      expect(spyValidar).toHaveBeenCalled();
      spyValidar.mockRestore();
    });

  });

  describe('Integracion WebSocket con Socket.IO Client', function() {
    var clientSocket;

    afterEach(function(done) {
      if (clientSocket && clientSocket.connected) {
        clientSocket.disconnect();
      }
      done();
    });

    it('deberia procesar y emitir evento con payload saneado a traves de Socket.IO', function(done) {
      clientSocket = ioClient(socketUrl, {
        transports: ['websocket'],
        forceNew: true
      });

      var payload = JSON.stringify({
        nombre: 'TesterSocket',
        mensaje: "<script>alert('XSS-Socket');</script>",
        color: '#000000'
      });

      clientSocket.on('connect', function() {
        clientSocket.emit('Evento-Mensaje-Server', payload);
      });

      clientSocket.on('Evento-Mensaje-Server', function(data) {
        var parsed = JSON.parse(data);
        expect(parsed.mensaje).not.toContain('<script>');
        expect(parsed.mensaje).toContain('&lt;script&gt;');
        done();
      });
    });

    it('deberia procesar y emitir evento con imagen embebida a traves de Socket.IO', function(done) {
      clientSocket = ioClient(socketUrl, {
        transports: ['websocket'],
        forceNew: true
      });

      var payload = JSON.stringify({
        nombre: 'TesterSocket',
        mensaje: 'https://sitio.com/foto.png',
        color: '#000000'
      });

      clientSocket.on('connect', function() {
        clientSocket.emit('Evento-Mensaje-Server', payload);
      });

      clientSocket.on('Evento-Mensaje-Server', function(data) {
        var parsed = JSON.parse(data);
        expect(parsed.mensaje).toContain('<img src="https://sitio.com/foto.png"');
        done();
      });
    });

  });

});
