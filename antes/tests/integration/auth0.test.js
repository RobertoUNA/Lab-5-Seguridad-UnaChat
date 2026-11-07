var request = require('supertest');
var serverModule = require('../../server');

var app = serverModule.app;

describe('Pruebas de Integracion: Endpoints de Auth0 (Lab 8)', function() {

  it('GET /auth/config debe responder 200 con domain, clientId y enabled (sin exponer el secret)', async function() {
    var res = await request(app)
      .get('/auth/config')
      .expect(200);

    expect(res.body).toHaveProperty('enabled');
    expect(res.body).toHaveProperty('domain');
    expect(res.body).toHaveProperty('clientId');
    expect(res.body).not.toHaveProperty('client_secret');
    expect(res.body).not.toHaveProperty('secret');
  });

  it('GET /sala debe responder 401 si no hay cookie de sesion valida', async function() {
    var res = await request(app)
      .get('/sala')
      .expect(401);

    expect(res.text).toContain('401');
  });

  it('GET /auth/login debe redirigir (302) a la pagina de autorizacion de Auth0', async function() {
    process.env.AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'dev-test.auth0.com';
    process.env.AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || 'dummy-client-id';

    var res = await request(app)
      .get('/auth/login')
      .expect(302);

    expect(res.headers.location).toContain('authorize');
    expect(res.headers.location).toContain('response_type=code');
  });

  it('GET /auth/me debe responder 401 si no hay usuario autenticado', async function() {
    var res = await request(app)
      .get('/auth/me')
      .expect(401);

    expect(res.body.error).toBe('No autenticado');
  });

});
