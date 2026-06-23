# 万岁

万岁是一个面向 iPhone Safari 的响应式 PWA 打卡应用。

## 目录结构

```text
.
├── app/               当前正式版本的实现代码
├── docs/              本地保留的版本文档
├── 发布工具/          一键发布脚本和历史脚本
├── .github/           GitHub Pages 自动发布
└── README.md          项目入口说明
```

## App 代码

实际实现代码都在 [`app/`](./app/)。

```bash
cd app
node scripts/server.mjs
```

打开 `http://127.0.0.1:4173`。

## 测试与构建

```bash
cd app
node --test
node scripts/build.mjs
```

## Supabase

1. 在 Supabase SQL Editor 执行 [`app/supabase/schema.sql`](./app/supabase/schema.sql)，这是 V1.x 打卡数据基础表。
2. 如果要启用 V2.0 首页运势塔罗，再执行 [`app/supabase/migrations/v2.0.sql`](./app/supabase/migrations/v2.0.sql)。
3. 将 `app/config.js` 中的 `supabaseUrl` 和 `supabasePublishableKey` 填入。
4. 未配置 Supabase 时，应用使用本机 IndexedDB 模式，方便先预览与验收 UI。

V1.x 旧用户 `ysw` 会保留；打卡固定生效日期为 `2026-06-10`。V2.0 首页运势塔罗从用户首次填写出生信息当天开始生成。

## 发布

正式发布只用这个脚本：

- [`发布工具/同步正式版到GitHub.command`](./发布工具/同步正式版到GitHub.command)

GitHub 只同步正式版需要的内容：

- `.github/`
- `.gitignore`
- `README.md`
- `app/`

文档、设计稿、历史脚本只保留在本地，不再一起堆到 GitHub。

每个正式版本通过 GitHub 的 `main + tag` 保留，比如 `v1.1`。

更多说明见 [`发布工具/README.md`](./发布工具/README.md) 和 [`docs/README.md`](./docs/README.md)。
