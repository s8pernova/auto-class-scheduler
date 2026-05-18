#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="course-scheduler"
APP_DIR="/srv/course-scheduler"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
COMPOSE_ENV="/etc/course-scheduler/compose.env"

# shellcheck source=/dev/null
source "$COMPOSE_ENV"
HEALTH_URL="http://127.0.0.1:${BACKEND_PORT:-8020}/api/v1/health"

compose() {
  docker compose \
    --project-name "$APP_NAME" \
    --env-file "$COMPOSE_ENV" \
    -f "$COMPOSE_FILE" \
    "$@"
}

log() {
  printf '\n[%s] %s\n' "$(date -Is)" "$*"
}

fail() {
  local exit_code=$?
  local line_no=${1:-unknown}

  printf '\n[deploy failed] line=%s exit=%s\n' "$line_no" "$exit_code" >&2

  compose ps || true
  compose logs --tail=120 || true

  exit "$exit_code"
}

trap 'fail $LINENO' ERR

cd "$APP_DIR"

log "Validating required files"
test -f "$COMPOSE_FILE"
test -f "$COMPOSE_ENV"

log "Validating Docker access"
docker ps >/dev/null

log "Validating Docker Compose config"
compose config -q

log "Building images"
compose --progress=plain build --pull

log "Starting containers"
compose up -d --remove-orphans

log "Checking container status"
compose ps

log "Checking backend health"
for attempt in {1..30}; do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    log "Backend health check passed"
    break
  fi

  if [ "$attempt" -eq 30 ]; then
    log "Backend health check failed after 30 attempts"
    curl -v "$HEALTH_URL" || true
    exit 1
  fi

  sleep 2
done

log "Recent logs"
compose logs --tail=80 || true

log "Deploy complete"
