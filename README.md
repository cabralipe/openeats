<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1jdk_g9aTLr5gp6jLWJUO5OgVLcABR8zt

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend (Django + PostgreSQL)

1. Copie `backend/.env.example` para `backend/.env` e ajuste se necessario.
2. Suba o backend com Docker:
   `docker compose up --build`
   Obs.: o Postgres do container esta configurado para a porta `5434` do host (arquivo `.env` na raiz).

API base: `http://localhost:8000`

Credenciais seed:
`admin@semed.local` / `Admin123!`

## Testes

Backend:
`cd backend && pytest`

## Carga (Locust)

1. Suba o backend:
   `docker compose up --build`
2. Em outro terminal:
   `cd backend && locust -f locustfile.py --host http://localhost:8000`

## Deploy no Render

Este repositório já está preparado com `render.yaml` para subir:
- `openeats-api` (Django + Gunicorn)
- `openeats-web` (SPA React/Vite)
- `openeats-db` (PostgreSQL)

Passos:
1. No Render, clique em **New +** > **Blueprint**.
2. Conecte este repositório.
3. Confirme a criação dos 3 serviços do `render.yaml`.
4. Após o primeiro deploy, ajuste os valores se necessário:
   - `openeats-api` > `CORS_ALLOWED_ORIGINS` com a URL real do frontend.
   - `openeats-web` > `VITE_API_BASE` com a URL real do backend.

Observações:
- O backend executa `migrate` no start e `collectstatic` no build.
- `SECRET_KEY` é gerada automaticamente no Render.
