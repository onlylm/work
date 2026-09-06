#!/usr/bin/env bash
set -Eeuo pipefail

INSTALL_DIR=${INSTALL_DIR:-/opt/personal-workbench}
REPO_URL=${REPO_URL:-https://github.com/onlylm/work.git}
APP_PORT=${APP_PORT:-8790}
NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmmirror.com}
WORKBENCH_DOMAIN=${WORKBENCH_DOMAIN:-}

if [[ ${EUID} -ne 0 ]]; then
  echo "请使用 sudo 运行此脚本。" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  command -v systemctl >/dev/null 2>&1 && systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "当前 Docker 缺少 Compose 插件，请先安装 docker-compose-plugin。" >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "服务器缺少 git，请先安装 git。" >&2
  exit 1
fi

mkdir -p "${INSTALL_DIR}"
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  git -C "${INSTALL_DIR}" fetch origin main
  git -C "${INSTALL_DIR}" checkout main
  git -C "${INSTALL_DIR}" pull --ff-only origin main
else
  git clone --branch main "${REPO_URL}" "${INSTALL_DIR}"
fi
cd "${INSTALL_DIR}"

if [[ ! -f .env ]]; then
  umask 077
  cat > .env <<EOF
APP_PORT=${APP_PORT}
NPM_REGISTRY=${NPM_REGISTRY}
POSTGRES_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
INVENTORY_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
EOF
fi
chmod 600 .env
if ! grep -q '^ADMIN_EMAIL=' .env; then
  admin_domain="${WORKBENCH_DOMAIN#www.}"
  [[ -n "${admin_domain}" ]] || admin_domain="local"
  echo "ADMIN_EMAIL=admin@${admin_domain}" >> .env
fi
if ! grep -q '^ADMIN_PASSWORD=' .env; then
  echo "ADMIN_PASSWORD=$(openssl rand -hex 12)" >> .env
fi

# 查找 shuku/NIMAIL 已有的 Caddy，以及它所在的 Docker 网络和 domains 挂载目录。
CADDY_CONTAINER=""
CADDY_NETWORK=""
CADDY_DOMAINS_DIR=""
while read -r candidate; do
  [[ -n "${candidate}" ]] || continue
  network=$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "${candidate}" 2>/dev/null | head -n 1 || true)
  domains=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/domains"}}{{.Source}}{{end}}{{end}}' "${candidate}" 2>/dev/null || true)
  if [[ -n "${network}" ]]; then
    CADDY_CONTAINER="${candidate}"
    CADDY_NETWORK="${network}"
    CADDY_DOMAINS_DIR="${domains}"
    [[ -n "${domains}" ]] && break
  fi
done < <(docker ps -q --filter 'label=com.docker.compose.service=caddy')

COMPOSE_ARGS=(-f docker-compose.yml)
if [[ -n "${CADDY_NETWORK}" ]]; then
  cat > docker-compose.caddy.yml <<EOF
services:
  app:
    networks:
      internal:
      shared_caddy:
        aliases:
          - personal-workbench
networks:
  shared_caddy:
    external: true
    name: ${CADDY_NETWORK}
EOF
  COMPOSE_ARGS+=(-f docker-compose.caddy.yml)
fi

docker compose "${COMPOSE_ARGS[@]}" up -d --build

if [[ -n "${WORKBENCH_DOMAIN}" ]]; then
  if [[ -z "${CADDY_CONTAINER}" || -z "${CADDY_DOMAINS_DIR}" ]]; then
    echo "应用已启动，但没有找到带 /etc/caddy/domains 挂载的现有 Caddy，未配置域名。" >&2
    exit 2
  fi
  install -d -m 0755 "${CADDY_DOMAINS_DIR}"
  cat > "${CADDY_DOMAINS_DIR}/personal-workbench.caddy" <<EOF
${WORKBENCH_DOMAIN} {
  encode zstd gzip
  reverse_proxy personal-workbench:3000
}
EOF
  docker exec "${CADDY_CONTAINER}" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  docker exec "${CADDY_CONTAINER}" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
fi

echo
echo "个人经营工作台部署完成。"
echo "本机地址：http://127.0.0.1:${APP_PORT}"
if [[ -n "${WORKBENCH_DOMAIN}" ]]; then
  echo "公网地址：https://${WORKBENCH_DOMAIN}"
else
  echo "尚未配置域名。重新运行时增加 WORKBENCH_DOMAIN=你的域名即可自动接入现有 Caddy。"
fi
echo
echo "管理员账号：$(sed -n 's/^ADMIN_EMAIL=//p' .env)"
echo "管理员密码：$(sed -n 's/^ADMIN_PASSWORD=//p' .env)"
echo "请妥善保存密码，不要把服务器 .env 文件发送给他人。"
