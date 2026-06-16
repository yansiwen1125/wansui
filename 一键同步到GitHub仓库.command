#!/bin/zsh
set -e

SOURCE_DIR="/Users/sally/Documents/万岁万岁万万岁"
TARGET_DIR="/Users/sally/Documents/wansui"

echo "正在同步万岁 App 到 GitHub Desktop 仓库..."

if [ ! -d "$TARGET_DIR/.git" ]; then
  echo "没有找到 Git 仓库：$TARGET_DIR"
  echo "请先在 GitHub Desktop 创建名为 wansui 的仓库。"
  read -k 1 "?按任意键退出"
  exit 1
fi

rsync -av \
  --exclude ".git" \
  --exclude "dist" \
  --exclude ".DS_Store" \
  --exclude "design/.DS_Store" \
  "$SOURCE_DIR/" "$TARGET_DIR/"

cd "$TARGET_DIR"

node_path="/Users/sally/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [ -x "$node_path" ]; then
  "$node_path" scripts/generate-icons.mjs
  "$node_path" --test
  "$node_path" scripts/build.mjs
else
  node scripts/generate-icons.mjs
  node --test
  node scripts/build.mjs
fi

git add .

if git diff --cached --quiet; then
  echo "没有新的改动需要提交。"
else
  git commit -m "Add Wansui app"
  echo "已提交到本地 Git 仓库。"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git push origin main
  echo "已推送到 GitHub。"
fi

echo ""
echo "完成。现在可以去 GitHub 查看 Pages 发布状态。"
read -k 1 "?按任意键退出"
