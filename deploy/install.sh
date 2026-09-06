#!/usr/bin/env bash
set -Eeuo pipefail
INSTALL_DIR=/opt/personal-workbench
REPO_URL=${REPO_URL:-https://github.com/onlylm/work.git}
APP_PORT=${APP_PORT:-8790}
if [[ ${EUID} -ne 0 ]]; then echo "请使用 sudo 运行" >&2; exit 1; fi
command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sh; systemctl enable --now docker; }
if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else apt-get update && apt-get install -y docker-compose-plugin; COMPOSE="docker compose"; fi
mkdir -p "$INSTALL_DIR"
if [[ -d "$INSTALL_DIR/.git" ]]; then git -C "$INSTALL_DIR" pull --ff-only; else git clone "$REPO_URL" "$INSTALL_DIR"; fi
cd "$INSTALL_DIR"
if [[ ! -f .env ]]; then
  umask 077
  cat > .env <<EOF
APP_PORT=$APP_PORT
POSTGRES_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
INVENTORY_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
EOF
fi
$COMPOSE up -d --build
echo "部署完成：http://127.0.0.1:${APP_PORT}"
echo "该端口仅绑定回环地址，不与 NIMAIL(8788) 冲突。请在现有 Caddy 中反代到 127.0.0.1:${APP_PORT}。"
