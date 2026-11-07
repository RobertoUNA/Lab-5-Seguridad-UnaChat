// Modulo de conexion a Supabase Vault para UNA Chat
const { Pool } = require('pg');

let pool = null;
let cachedSecret = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // Cache por 1 minuto para rendimiento

function getPool() {
  if (!pool && process.env.VAULT_DATABASE_URL) {
    // Si la URL contiene sslmode, removerlo de la query string para evitar que
    // pg-connection-string fuerce rejectUnauthorized: true sobre certificados intermedios
    let connectionString = process.env.VAULT_DATABASE_URL;
    connectionString = connectionString.replace(/([?&])sslmode=[^&]*(&|$)/, (match, p1, p2) => (p2 === '&' ? p1 : ''));
    if (connectionString.endsWith('?')) {
      connectionString = connectionString.slice(0, -1);
    }

    pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false // Permite conexion SSL segura con el pooler de Supabase
      },
      connectionTimeoutMillis: 7000
    });

    pool.on('error', (err) => {
      console.warn('Error en el pool de conexion a Vault:', err.message);
    });
  }
  return pool;
}

/**
 * Obtiene el Client Secret de Auth0.
 * Prioridad:
 * 1. Supabase Vault (si VAULT_DATABASE_URL esta definida)
 * 2. AUTH0_CLIENT_SECRET desde variables de entorno
 */
async function getAuth0ClientSecret() {
  const now = Date.now();
  if (cachedSecret && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedSecret;
  }

  // 1. Intentar leer desde Supabase Vault
  if (process.env.VAULT_DATABASE_URL) {
    try {
      const p = getPool();
      if (p) {
        const result = await p.query('SELECT una_chat_private.get_auth0_client_secret() AS secret;');
        if (result.rows && result.rows.length > 0 && result.rows[0].secret) {
          cachedSecret = result.rows[0].secret;
          lastFetchTime = now;
          console.log('[Vault] Secreto de Auth0 obtenido exitosamente desde Supabase Vault.');
          return cachedSecret;
        }
      }
    } catch (err) {
      console.warn('Aviso: No se pudo obtener el secreto desde Supabase Vault:', err.message);
      // Fallback a variable de entorno si existe
    }
  }

  // 2. Fallback a variable de entorno
  if (process.env.AUTH0_CLIENT_SECRET) {
    return process.env.AUTH0_CLIENT_SECRET;
  }

  return null;
}

function clearSecretCache() {
  cachedSecret = null;
  lastFetchTime = 0;
}

module.exports = {
  getAuth0ClientSecret,
  clearSecretCache
};
