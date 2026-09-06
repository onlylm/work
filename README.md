# 个人经营工作台

面向个人经营者的客户、业务、资金、库存、交付与提醒工作台。当前为第一版开发基线，包含响应式工作台、快速记录确认交互、PostgreSQL/Drizzle 数据模型、美元移动加权成本测试和 Docker 一键部署。

## 本地运行

```bash
pnpm install
pnpm dev
```

访问 `http://localhost:3000`。提交前运行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 一键部署

```bash
curl -fsSL https://raw.githubusercontent.com/onlylm/work/main/deploy/install.sh | sudo bash
```

默认仅监听 `127.0.0.1:8790`，不会与 NIMAIL 的 `127.0.0.1:8788` 冲突，也不会抢占 `shuku`/NIMAIL 共用的 80、443。把 `deploy/Caddyfile.example` 中的域名改为实际域名，加入现有 Caddy 配置即可使用 HTTPS。

首次安装自动生成 `/opt/personal-workbench/.env`，密钥不会提交 Git。PostgreSQL 使用独立数据卷，备份容器每天生成压缩备份并保留 14 天。

## 安全约束

- 金额以整数分保存，美元使用定点数，时间使用带时区时间戳。
- 每条业务数据包含 `workspace_id`；成本缺失时利润为 `null`（待核算）。
- 敏感库存只保存密文及去重摘要，密钥仅来自环境变量。
- 自然语言录入先预览确认，再通过事务写入。
- 本项目与 `shuku`、`NIMAIL` 不共享业务数据。

## 依赖许可

Next.js/React/Tailwind/Zod/jose/bcryptjs/Vitest（MIT），Drizzle ORM（Apache-2.0），Lucide React（ISC），postgres.js（Unlicense）。

## 当前阶段

本次交付是第一版可部署开发基线，页面数据暂为验收示例。后续按开发说明逐模块接入真实 CRUD、登录会话、库存事务、自然语言解析和完整报表。
