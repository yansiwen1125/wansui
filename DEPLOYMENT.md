# 万岁 V1 上线步骤

## 1. 创建 Supabase 项目

1. 在 Supabase 创建一个项目。
2. 打开 SQL Editor，执行 `supabase/schema.sql`。
3. 在 Project Settings 的 API 页面找到：
   - Project URL
   - Publishable key（旧项目中可能显示为 anon key）

V1 的用户名不是密码。页面只允许输入 `ysw`，这是产品约束，不是安全登录机制。

## 2. 创建 GitHub 仓库

1. 新建一个空仓库，例如 `wansui`。
2. 将本文件夹中的内容上传到仓库的 `main` 分支。
3. 打开仓库的 Settings → Secrets and variables → Actions。
4. 新建两个 Repository secrets：
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
5. 打开 Settings → Pages，将 Source 设为 `GitHub Actions`。

以后每次更新 `main` 分支，网站会自动测试、构建并发布。

## 3. iPhone 安装

1. 用 iPhone Safari 打开 GitHub Pages 提供的网址。
2. 首次输入用户名 `ysw`。
3. 点击 Safari 的分享按钮。
4. 选择“添加到主屏幕”。
5. 此后可以像普通 App 一样从桌面打开。

登录状态和最近数据会保存在手机本地；联网时打卡记录会同步到 Supabase。

## 4. 上线验收

- 输入其他用户名时不能进入。
- 输入 `ysw` 后，关闭并重新打开页面仍保持登录。
- 首页只能查看和记录 `2026-06-10` 至今天的数据。
- 打卡后刷新页面，状态不丢失。
- 在另一台设备输入 `ysw`，能看到已同步的数据。
- 断网时仍能打开页面并查看最近缓存。
- 恢复网络后，新打卡可以同步。
