FROM node:22-alpine AS frontend-builder
WORKDIR /frontend
COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_ASSET_BASE=/static/
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/
COPY --from=frontend-builder /frontend/dist /app/frontend_dist

CMD ["/bin/sh", "-c", "python manage.py collectstatic --noinput && python manage.py migrate && python manage.py seed && gunicorn merenda_semed.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 120"]
