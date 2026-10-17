// Modulo de validacion y saneamiento - UNA Lib (UNA Chat)

module.exports = {

  // Logica que valida si un telefono esta correcto
  is_valid_phone: function (phone) {
    var isValid = false;
    var re = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/i;

    try {
      isValid = re.test(phone);
    } catch (e) {
      console.log(e);
    } finally {
      return isValid;
    }
  },

  // Valida si el texto es una URL de imagen valida
  is_valid_url_image: function (url) {
    var isValid = false;
    // Expresion regular para URLs de imagenes validas (http/https y extensiones comunes)
    var re = /^https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|gif|png|bmp|webp)(?:\?[^\s<>"']*)?$/i;

    try {
      isValid = re.test(url);
    } catch (e) {
      console.log(e);
    } finally {
      return isValid;
    }
  },

  // Valida si el texto es una URL de video de YouTube valida
  is_valid_yt_video: function (url) {
    var isValid = false;
    // Expresion regular para URLs de YouTube (estandar, corta, embed)
    var re = /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})(?:\S*)?$/i;

    try {
      isValid = re.test(url);
    } catch (e) {
      console.log(e);
    } finally {
      return isValid;
    }
  },

  // Extrae el ID de 11 caracteres del video de YouTube de forma segura
  getYTVideoId: function(url) {
    try {
      var match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  },

  // Genera el codigo iframe embebido para videos de YouTube
  getEmbeddedCode: function (url) {
    var id = this.getYTVideoId(url);
    if (!id) return '';
    var code = '<iframe width="560" height="315" src="https://www.youtube.com/embed/' + id + '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    return code;
  },

  // Genera el tag <img> para URLs de imagen
  getImageTag: function(url) {
    var tag = '<img src="' + url + '" style="max-height: 400px;max-width: 400px;">';
    return tag;
  },

  // Sanea cadenas escapando caracteres especiales HTML para mitigar XSS / Script Injection
  sanitize: function(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  // Detecta si una cadena contiene scripts o etiquetas HTML potencialmente maliciosas
  contains_malicious_code: function(text) {
    if (typeof text !== 'string') return false;
    var scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|<[^>]+(on\w+\s*=|\bjavascript:)[^>]*>/i;
    return scriptPattern.test(text);
  },

  // Valida y sanea mensajes del chat
  validateMessage: function(msg) {
    if (!msg) {
      return JSON.stringify({ nombre: 'Anónimo', mensaje: '', color: '#000000' });
    }

    var obj;
    try {
      obj = (typeof msg === 'string') ? JSON.parse(msg) : msg;
    } catch (e) {
      obj = { nombre: 'Anónimo', mensaje: String(msg), color: '#000000' };
    }

    var rawMensaje = (obj.mensaje !== undefined && obj.mensaje !== null) ? String(obj.mensaje).trim() : '';
    var nombre = obj.nombre ? this.sanitize(String(obj.nombre)) : 'Anónimo';
    var color = obj.color || '#000000';

    // 1. Si es URL de imagen valida
    if (this.is_valid_url_image(rawMensaje)) {
      console.log("Es una imagen!");
      obj.mensaje = this.getImageTag(rawMensaje);
    }
    // 2. Si es URL de video de YouTube valida
    else if (this.is_valid_yt_video(rawMensaje)) {
      console.log("Es un video!");
      obj.mensaje = this.getEmbeddedCode(rawMensaje);
    }
    // 3. Texto regular o codigo malicioso
    else {
      if (this.contains_malicious_code(rawMensaje)) {
        console.log("¡Intento de inyeccion de script detectado y bloqueado/saneado!");
      } else {
        console.log("Es un texto!");
      }
      obj.mensaje = this.sanitize(rawMensaje);
    }

    obj.nombre = nombre;
    obj.color = color;

    return JSON.stringify(obj);
  },

  // Alias para mantener compatibilidad con la guia de laboratorio en espanol
  validarMensaje: function(msg) {
    return this.validateMessage(msg);
  }

};