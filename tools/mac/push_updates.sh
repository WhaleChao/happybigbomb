#!/bin/zsh
# 提交並推送到 main；推送後 GitHub Actions 會自動檢查並部署到 GitHub Pages
set -e
cd "$(dirname "$0")/../.."
MSG="$*"
if [ -z "$MSG" ]; then read "MSG?提交說明："; fi
[ -z "$MSG" ] && MSG=update
echo "1. 本機檢查..."
npm run lint && npm test && npm run build
echo "2. 提交並推送..."
git add -A
git commit -m "$MSG" || true
git push origin main
echo "完成：部署進度請看 GitHub 的 Actions 頁面"
