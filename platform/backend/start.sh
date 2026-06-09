#!/usr/bin/env bash
# start.sh — Script de démarrage production (Render)
#
# Ordre :
#   1. Attendre que PostgreSQL soit prêt
#   2. Lancer Alembic upgrade head
#   3. Démarrer Gunicorn
#
# Ce script remplace le CMD du Dockerfile en prod si on veut plus de contrôle.
# Sinon, le lifespan FastAPI dans main.py gère déjà le retry DB + migrations.

set -euo pipefail

echo "=== DataSphere Production Startup ==="
echo "APP_ENV: ${APP_ENV:-not set}"

# Wait for DB (Render injecte DATABASE_URL automatiquement)
if [ -n "${DATABASE_URL:-}" ]; then
    echo "Waiting for database..."
    python -c "
import time, psycopg2, os, urllib.parse

url = os.environ['DATABASE_URL']
# Render injecte parfois une URL postgres:// — psycopg2 veut postgresql://
url = url.replace('postgres://', 'postgresql://', 1)

for i in range(30):
    try:
        conn = psycopg2.connect(url, connect_timeout=3)
        conn.close()
        print(f'Database ready after {i+1} attempt(s)')
        break
    except Exception as e:
        print(f'Attempt {i+1}/30: {e}')
        time.sleep(2)
else:
    print('Database not available after 30 attempts. Exiting.')
    exit(1)
"
fi

# Run migrations
echo "Running Alembic migrations..."
alembic upgrade head
echo "Migrations done."

# Start Gunicorn
echo "Starting Gunicorn..."
exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 2 \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 120 \
    --keep-alive 5 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
