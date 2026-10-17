var val = require('../libs/unalib');
var assert = require('assert');

describe('unalib - Suite de Pruebas Unitarias', function() {

  // 1. Pruebas de validacion telefonica (pruebas existentes)
  describe('funcion is_valid_phone', function() {
    it('deberia devolver true para 8297-8547', function() {
      assert.strictEqual(val.is_valid_phone('8297-8547'), true);
    });

    it('deberia devolver false para 8297p-8547', function() {
      assert.strictEqual(val.is_valid_phone('8297p-8547'), false);
    });
  });

  // 2. Pruebas de URLs de imagenes (Paso 7: Validacion de URLs de Imagenes)
  describe('funcion is_valid_url_image', function() {
    it('deberia devolver true para http://image.com/image.jpg', function() {
      assert.strictEqual(val.is_valid_url_image('http://image.com/image.jpg'), true);
    });

    it('deberia devolver true para http://image.com/image.gif', function() {
      assert.strictEqual(val.is_valid_url_image('http://image.com/image.gif'), true);
    });

    it('deberia devolver true para https://dominio.com/foto.png', function() {
      assert.strictEqual(val.is_valid_url_image('https://dominio.com/foto.png'), true);
    });

    it('deberia devolver false para una URL que no sea imagen (ej. .html)', function() {
      assert.strictEqual(val.is_valid_url_image('https://ejemplo.com/pagina.html'), false);
    });

    it('deberia devolver false para texto comun que no es URL', function() {
      assert.strictEqual(val.is_valid_url_image('Hola mundo'), false);
    });

    it('deberia generar correctamente la etiqueta <img> en getImageTag', function() {
      var tag = val.getImageTag('https://image.com/foto.png');
      assert.strictEqual(tag.indexOf('<img src="https://image.com/foto.png"') !== -1, true);
    });
  });

  // 3. Pruebas de URLs de videos (Paso 7: Validacion de URLs de Videos)
  describe('funcion is_valid_yt_video', function() {
    it('deberia devolver true para URL estandar de YouTube', function() {
      assert.strictEqual(val.is_valid_yt_video('https://www.youtube.com/watch?v=qYwlqx-JLok'), true);
    });

    it('deberia devolver true para URL corta de YouTube (youtu.be)', function() {
      assert.strictEqual(val.is_valid_yt_video('https://youtu.be/qYwlqx-JLok'), true);
    });

    it('deberia devolver false para una URL de otro sitio o video invalido', function() {
      assert.strictEqual(val.is_valid_yt_video('https://vimeo.com/12345678'), false);
    });

    it('deberia devolver false para texto plano', function() {
      assert.strictEqual(val.is_valid_yt_video('video de youtube'), false);
    });

    it('deberia extraer correctamente el ID del video con getYTVideoId', function() {
      var id = val.getYTVideoId('https://www.youtube.com/watch?v=qYwlqx-JLok');
      assert.strictEqual(id, 'qYwlqx-JLok');
    });

    it('deberia generar correctamente el iframe embebido en getEmbeddedCode', function() {
      var iframe = val.getEmbeddedCode('https://www.youtube.com/watch?v=qYwlqx-JLok');
      assert.strictEqual(iframe.indexOf('src="https://www.youtube.com/embed/qYwlqx-JLok"') !== -1, true);
    });
  });

  // 4. Pruebas de Prevencion de Inyeccion de Scripts (Paso 7: Prevencion de Inyeccion de Scripts)
  describe('Prevencion de Inyeccion de Scripts (XSS)', function() {
    it('deberia detectar intentos de script injection con contains_malicious_code', function() {
      var maliciousPayload = "<script>alert('Inyección de script');</script>";
      assert.strictEqual(val.contains_malicious_code(maliciousPayload), true);
    });

    it('deberia detectar payloads con eventos onerror maliciosos', function() {
      var maliciousPayload = "<img src='invalido' onerror='alert(1)'>";
      assert.strictEqual(val.contains_malicious_code(maliciousPayload), true);
    });

    it('deberia escapar caracteres especiales HTML en funcion sanitize', function() {
      var raw = "<script>alert('test')</script>";
      var sanitized = val.sanitize(raw);
      assert.strictEqual(sanitized, "&lt;script&gt;alert(&#x27;test&#x27;)&lt;/script&gt;");
    });

    it('deberia sanear y neutralizar scripts en validateMessage', function() {
      var input = JSON.stringify({
        nombre: 'Atacante',
        mensaje: "<script>alert('Inyección de script');</script>",
        color: '#ff0000'
      });

      var result = JSON.parse(val.validateMessage(input));
      // El script debe estar saneado (sin tags ejecutables <script>)
      assert.strictEqual(result.mensaje.indexOf('<script>'), -1);
      assert.strictEqual(result.mensaje.indexOf('&lt;script&gt;'), 0);
    });

    it('deberia procesar correctamente URLs de imagenes dentro de validateMessage', function() {
      var input = JSON.stringify({
        nombre: 'Usuario',
        mensaje: 'https://sitio.com/foto.jpg',
        color: '#00ff00'
      });

      var result = JSON.parse(val.validateMessage(input));
      assert.strictEqual(result.mensaje.indexOf('<img src="https://sitio.com/foto.jpg"'), 0);
    });

    it('deberia procesar correctamente URLs de videos de YouTube dentro de validateMessage', function() {
      var input = JSON.stringify({
        nombre: 'Usuario',
        mensaje: 'https://www.youtube.com/watch?v=qYwlqx-JLok',
        color: '#0000ff'
      });

      var result = JSON.parse(val.validateMessage(input));
      assert.strictEqual(result.mensaje.indexOf('<iframe'), 0);
      assert.strictEqual(result.mensaje.indexOf('qYwlqx-JLok') !== -1, true);
    });

    it('deberia funcionar correctamente con el alias validarMensaje', function() {
      var input = JSON.stringify({
        nombre: 'Usuario',
        mensaje: 'Hola mundo seguro',
        color: '#123456'
      });

      var result = JSON.parse(val.validarMensaje(input));
      assert.strictEqual(result.mensaje, 'Hola mundo seguro');
    });
  });

});
