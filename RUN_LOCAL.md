# Merenda SEMED - Guia De Execucao Local

Este guia cobre backend (Django + PostgreSQL), frontend (Vite/React), seed inicial, testes e carga.

## 1. Pre-requisitos

- Docker + Docker Compose
- Node.js 18+ e npm

## 2. Configurar variaveis de ambiente do backend

No raiz do projeto:

```bash
cp backend/.env.example backend/.env
```

Se quiser, edite `backend/.env` com seus valores.

## 3. Subir backend e banco

No raiz do projeto:

```bash
docker compose up --build
```

Isso vai:
- subir PostgreSQL
- rodar migrations
- rodar seed inicial
- iniciar Django em `http://localhost:8000`
- expor PostgreSQL na porta `5434` do host (configurada em `.env`; altere `POSTGRES_HOST_PORT` se quiser)

## 4. Subir frontend

Em outro terminal, no raiz do projeto:

```bash
npm install
npm run dev
```

Frontend em `http://localhost:3000`.

### 4.1 Configuracao de ambiente do frontend

Escolha um dos cenarios abaixo e copie o arquivo para `.env.local` na raiz:

Backend local (recomendado para desenvolvimento):

```bash
cp .env.frontend.local.example .env.local
```

Backend no Render:

```bash
cp .env.frontend.render.example .env.local
```

## 5. Login inicial (seed)

- Email: `admin@semed.local`
- Senha: `Admin123!`

## 6. URLs importantes

- API base: `http://localhost:8000`
- Swagger/OpenAPI: `http://localhost:8000/api/docs/`
- Admin Django: `http://localhost:8000/admin/`

## 7. Rodar testes backend

```bash
cd backend
pytest
```

## 8. Teste de carga (Locust)

Com backend rodando:

```bash
cd backend
locust -f locustfile.py --host http://localhost:8000
```

Abra: `http://localhost:8089`

## 9. Exportacoes (CSV/PDF)

Endpoints disponiveis:
- `GET /api/exports/stock/` (CSV)
- `GET /api/exports/menus/` (CSV)
- `GET /api/exports/menus/pdf/?school=<UUID>&week_start=YYYY-MM-DD` (PDF)

Observacao: esses endpoints exigem autenticacao JWT.

## 10. Troubleshooting rapido

- Porta `5432` ocupada: altere no `docker-compose.yml` ou pare o Postgres local.
- Porta `3000` ocupada: altere `server.port` em `vite.config.ts`.
- Erro de login: confirme que o `docker compose` terminou migrations/seed.
- Banco "sujo": para resetar volumes:

```bash
docker compose down -v
docker compose up --build
```
