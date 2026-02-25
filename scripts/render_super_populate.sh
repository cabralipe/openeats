#!/bin/sh
set -eu

# Executar na pasta backend/ (onde existe manage.py)
# Exemplo:
#   ./scripts/render_super_populate.sh
# ou com limpeza antes:
#   ALLOW_DESTRUCTIVE_RESET=true RESET_FIRST=true ./scripts/render_super_populate.sh

if [ ! -f "manage.py" ]; then
  echo "ERRO: execute este script na pasta backend/ (onde existe manage.py)."
  exit 1
fi

echo "[render_super_populate] Aplicando migrations..."
python manage.py migrate

if [ "${RESET_FIRST:-}" = "true" ] || [ "${RESET_FIRST:-}" = "1" ]; then
  if [ "${ALLOW_DESTRUCTIVE_RESET:-}" != "true" ] && [ "${ALLOW_DESTRUCTIVE_RESET:-}" != "1" ]; then
    echo "ERRO: RESET_FIRST=true exige ALLOW_DESTRUCTIVE_RESET=true."
    exit 1
  fi
  echo "[render_super_populate] Limpando dados antes de popular..."
  python manage.py reset_all_data --confirm --no-seed
fi

echo "[render_super_populate] Executando seed base..."
python manage.py seed

echo "[render_super_populate] Executando super populate demo..."
python manage.py super_populate_demo --reset-demo-generated

echo "[render_super_populate] Concluido."
