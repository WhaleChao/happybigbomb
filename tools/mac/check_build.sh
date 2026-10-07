#!/bin/zsh
# 本機完整檢查：git 狀態、lint、單元測試、建置
set -e
cd "$(dirname "$0")/../.."
echo "=== GIT STATUS ==="; git status
echo "=== LINT ==="; npm run lint
echo "=== TEST ==="; npm test
echo "=== BUILD ==="; npm run build
npm run check:static
echo "=== 全部通過 ==="
