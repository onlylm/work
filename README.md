# 个人经营工作台 v0.2.0

个人经营者使用的客户、业务、资金、商品、待办和常用网站管理系统。本版本已移除硬编码演示数据，页面读写 PostgreSQL，并加入管理员登录保护。

## 已实现

- 自动初始化单一管理员，bcrypt 哈希保存密码。
- JWT 签名的 HttpOnly、SameSite 会话 Cookie；生产环境仅通过 HTTPS 发送。
- 登录失败限流：同一账号 15 分钟内最多失败 5 次。
- 所有业务页面及服务端写操作校验登录会话和 `workspace_id`。
- 客户资料新增、列表与最近业务信息。
- 统一业务录入、收款、成本、直接支出、状态和利润计算。
- 成本留空时显示“待核算”，不按零成本虚增利润。
- 业务收款自动生成关联的人民币资金流水。
- 人民币收支记录。
- 美元充值、消费、余额与移动加权平均成本，事务内加锁防止并发错账。
- 商品基础资料、待办事项、常用网站的新增和列表。
- 会员类业务筛选、真实数据经营汇总报表。
- 本地规则自然语言快速记录，必须预览确认后才写入。
- 所有关键新增与待办完成动作保留审计基础。
- Docker Compose、PostgreSQL 迁移、每日备份及共享 Caddy 一键部署。

账号库存加密交付、会员精确到期时间和完整库存批次尚未开放；界面会明确显示未启用，不会提供不安全的半成品操作。

## 一键部署或升级

```bash
curl -fsSL https://raw.githubusercontent.com/onlylm/work/main/deploy/install.sh \
  | WORKBENCH_DOMAIN=www.bugan.cn bash
```

脚本自动复用服务器现有 `shuku`/`NIMAIL` Caddy，不新增 80/443 监听；应用仅绑定 `127.0.0.1:8790`。首次成功部署会在终端显示管理员邮箱和随机密码，请立即妥善保存。

验证：

```bash
curl https://www.bugan.cn/api/health
```

## 本地开发

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

需要配置 `DATABASE_URL`、`AUTH_SECRET`、`ADMIN_EMAIL` 和 `ADMIN_PASSWORD`。提交前运行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

核心依赖采用 MIT、Apache-2.0、ISC 或 Unlicense 等宽松许可证。
