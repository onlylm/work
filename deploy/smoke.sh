#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL=${BASE_URL:-http://127.0.0.1:8790}
ADMIN_EMAIL=${ADMIN_EMAIL:-}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-}

echo "冒烟测试：${BASE_URL}/api/health"
health=$(curl -fsS "${BASE_URL}/api/health")
echo "${health}" | grep -q '"ok":true' || { echo "健康检查失败" >&2; exit 1; }

if [[ -n "${ADMIN_EMAIL}" && -n "${ADMIN_PASSWORD}" ]]; then
  echo "冒烟测试：登录页可访问"
  curl -fsS "${BASE_URL}/login" | grep -q "管理员登录" || { echo "登录页异常" >&2; exit 1; }
fi

echo "冒烟测试通过"
