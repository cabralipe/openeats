# Render - New Web Service (Docker) para `openeats`

Preencha a tela **New Web Service** assim:

## Source Code
- `cabralipe/openeats`

## Name
- `openeats` (ou `openeats-app` se o nome já estiver em uso)

## Project (Optional)
- `openeats`

## Environment
- `Production`

## Language
- `Docker`

## Branch
- `main`

## Region
- `Oregon (US West)` (mesma região dos outros serviços)

## Root Directory (Optional)
- deixe **vazio**

## Instance Type
- pode usar `Free` (para teste)

## Environment Variables
Adicione estas variáveis:

- `SECRET_KEY=<GERAR_VALOR_SEGURO_ALEATORIO>`
- `DEBUG=False`
- `ALLOWED_HOSTS=.onrender.com`
- `CSRF_TRUSTED_ORIGINS=https://*.onrender.com,https://onrender.com`
- `CORS_ALLOW_ALL_ORIGINS=False`
- `CORS_ALLOWED_ORIGINS=https://openeats.onrender.com,https://openeats-web.onrender.com,https://openeats-api.onrender.com`
- `SECURE_SSL_REDIRECT=True`
- `DATABASE_URL=<DATABASE_URL_DO_POSTGRES_RENDER>`
- `SEED_ADMIN_EMAIL=admin@semed.local`
- `SEED_ADMIN_PASSWORD=Admin123!`

## Advanced

### Secret Files
- não precisa para esse projeto (deixe vazio)

### Health Check Path
- `/api/docs/`

### Registry Credential
- `No credential`

### Docker Build Context Directory
- `.`

### Dockerfile Path
- `   `

### Docker Command
- deixe **vazio** (usar `CMD` do Dockerfile)

### Pre-Deploy Command
- deixe **vazio**

### Auto-Deploy
- `On Commit` (recomendado)

### Build Filters
- deixe vazio

## Deploy
- clique em **Deploy web service**

## Verificação após deploy
1. Abra `https://SEU-SERVICO.onrender.com/api/docs/` (deve abrir).
2. Abra `https://SEU-SERVICO.onrender.com/api/auth/token/` no navegador:
   - esperado: `405 Method Not Allowed` (GET)
   - se der `404`, o serviço não está rodando o backend Django correto.
