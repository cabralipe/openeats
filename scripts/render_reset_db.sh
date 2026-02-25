#!/bin/sh
set -eu

# Uso (Render shell/job):
#   ALLOW_DESTRUCTIVE_RESET=true python manage.py migrate
#   ALLOW_DESTRUCTIVE_RESET=true ./scripts/render_reset_db.sh
#
# Opcional para popular demo completo:
#   ALLOW_DESTRUCTIVE_RESET=true SUPER_POPULATE_AFTER_RESET=true ./scripts/render_reset_db.sh

if [ "${ALLOW_DESTRUCTIVE_RESET:-}" != "true" ] && [ "${ALLOW_DESTRUCTIVE_RESET:-}" != "1" ]; then
  echo "ERRO: defina ALLOW_DESTRUCTIVE_RESET=true para permitir limpeza total."
  exit 1
fi

if [ ! -f "manage.py" ]; then
  echo "ERRO: execute este script na pasta backend/ (onde existe manage.py)."
  exit 1
fi

echo "[render_reset_db] Aplicando migrations..."
python manage.py migrate

echo "[render_reset_db] Limpando dados (flush)..."
if [ "${SUPER_POPULATE_AFTER_RESET:-}" = "true" ] || [ "${SUPER_POPULATE_AFTER_RESET:-}" = "1" ]; then
  python manage.py reset_all_data --confirm --with-super-populate
else
  python manage.py reset_all_data --confirm
fi

echo "[render_reset_db] Concluido."
