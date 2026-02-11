# Render - Environment Setup

Use esta seção no serviço `openeats` no Render:

## Environment

- Clique em **Create environment group** (opcional, se quiser compartilhar variáveis com outros serviços).

## Environment Variables

Set environment-specific config and secrets (such as API keys), then read those values from your code.

- Botões disponíveis: **Export** e **Edit**.

Preencha a tabela **Key / Value** assim:

| Key | Value |
|---|---|
| CORS_ALLOW_ALL_ORIGINS | `False` |
| DATABASE_URL | valor do banco PostgreSQL do Render (`Internal Database URL` ou `External Database URL`) |
| SECRET_KEY | gere um valor seguro aleatório |
| DEBUG | `False` |
| ALLOWED_HOSTS | `.onrender.com` |
| CSRF_TRUSTED_ORIGINS | `https://*.onrender.com,https://onrender.com` |
| SECURE_SSL_REDIRECT | `True` |
| SEED_ADMIN_EMAIL | `admin@semed.local` |
| SEED_ADMIN_PASSWORD | `Admin123!` |

## Secret Files

Store plaintext files containing secret data (such as a `.env` file or a private key).
Access during builds and at runtime from your app's root, or from `/etc/secrets/<filename>`.

- Clique em **Add** apenas se precisar enviar arquivos secretos.
- Para este projeto, normalmente **não é necessário** usar Secret Files.

## Linked Environment Groups

Environment groups are collections of environment variables and secret files that you can share across multiple services.

- Se aparecer **No environment groups available to link**, clique em **New Environment Group** para criar um.
- Se você tem apenas o serviço `openeats`, pode manter tudo direto no próprio serviço.

## Checklist final

1. Confirme que `DATABASE_URL` está apontando para o banco correto.
2. Salve as variáveis.
3. Faça **Manual Deploy** (ou aguarde Auto Deploy).
4. Valide:
   - `https://openeats.onrender.com/api/docs/`
   - `https://openeats.onrender.com/api/auth/token/` (GET deve retornar 405, não 404)
