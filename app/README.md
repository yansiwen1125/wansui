# App 实现代码

这里放万岁 App 的实际运行代码。

## 常用命令

```bash
node scripts/server.mjs
node --test
node scripts/build.mjs
```

## 目录

- `src/`：页面、样式、业务逻辑、云端同步和本地缓存。
- `icons/`：PWA 和 iPhone 主屏幕图标。
- `scripts/`：构建、图标生成、本地预览脚本。
- `supabase/`：数据库 SQL。
- `test/`：自动测试。
- `dist/`：构建产物，不需要手动编辑。

## Supabase SQL

- `supabase/schema.sql`：V1.x 打卡、用户、任务、任务版本基础表。
- `supabase/migrations/v2.0.sql`：V2.0 出生信息与每日运势塔罗表。

线上升级时先保留已有数据，按顺序执行 SQL，不要删除旧表。

## V2.0 星历库

V2.0 使用官方 Astronomy Engine 浏览器版本计算真实星体位置。当前运行时从 jsDelivr 加载：

```text
https://cdn.jsdelivr.net/gh/cosinekitty/astronomy@master/source/js/astronomy.browser.min.js
```

如果线上加载不稳定，可以后续将官方文件固化到项目内发布。
