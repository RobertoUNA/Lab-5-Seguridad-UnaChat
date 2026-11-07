-- Script para configurar el acceso del rol una_chat_backend al secreto de Auth0 en Supabase Vault

-- 1. Crear el esquema privado si no existe
create schema if not exists una_chat_private;

-- 2. Crear función con SECURITY DEFINER para recuperar el secreto específico
create or replace function una_chat_private.get_auth0_client_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_value text;
begin
  select decrypted_secret
  into secret_value
  from vault.decrypted_secrets
  where name = 'una_chat_auth0_client_secret'
  limit 1;

  return secret_value;
end;
$$;

-- 3. Revocar permisos de ejecucion a roles publicos y no autorizados
revoke all on function una_chat_private.get_auth0_client_secret() from public;
revoke all on function una_chat_private.get_auth0_client_secret() from anon;
revoke all on function una_chat_private.get_auth0_client_secret() from authenticated;

-- 4. Asignar permiso de ejecucion unicamente al rol una_chat_backend
grant usage on schema una_chat_private to una_chat_backend;
grant execute on function una_chat_private.get_auth0_client_secret() to una_chat_backend;
