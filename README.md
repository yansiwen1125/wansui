# 万岁

万岁 V1.0 是一个面向 iPhone Safari 的响应式 PWA 打卡应用。

## 目录结构

```text
.
├── docs/              产品、设计、技术和团队文档
├── icons/             App 图标
├── scripts/           构建、图标生成和本地预览脚本
├── src/               App 源码
├── supabase/          云端数据库 SQL
├── test/              自动测试
├── index.html         App 入口
├── config.js          Supabase 云端配置
├── manifest.webmanifest
└── sw.js              PWA 离线缓存
```

## 本地运行

```bash
node scripts/server.mjs
```

打开 `http://127.0.0.1:4173`。

## 测试与构建

```bash
node --test
node scripts/build.mjs
```

## Supabase

1. 在 Supabase SQL Editor 执行 [`supabase/schema.sql`](./supabase/schema.sql)。
2. 将 `config.js` 中的 `supabaseUrl` 和 `supabasePublishableKey` 填入。
3. 未配置 Supabase 时，应用使用本机 IndexedDB 模式，方便先预览与验收 UI。

固定用户名为 `ysw`，固定生效日期为 `2026-06-10`。

## 发布

项目已包含 GitHub Pages 自动发布配置。完整步骤见
[`docs/technical/DEPLOYMENT.md`](./docs/technical/DEPLOYMENT.md)。

未配置 Supabase 时，应用会自动使用本机存储；配置后会将打卡记录同步到云端。

更多文档见 [`docs/README.md`](./docs/README.md)。
