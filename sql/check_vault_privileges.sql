-- Script para verificar los privilegios de acceso a la funcion del secreto y a Vault

select
  has_function_privilege('authenticated', 'una_chat_private.get_auth0_client_secret()', 'execute') as authenticated_execute,
  has_function_privilege('public', 'una_chat_private.get_auth0_client_secret()', 'execute') as public_execute,
  has_table_privilege('anon', 'vault.decrypted_secrets', 'select') as anon_reads_vault,
  has_table_privilege('authenticated', 'vault.decrypted_secrets', 'select') as authenticated_reads_vault,
  has_function_privilege('una_chat_backend', 'una_chat_private.get_auth0_client_secret()', 'execute') as backend_execute;
