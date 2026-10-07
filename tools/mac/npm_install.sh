#!/bin/zsh
# 安裝相依套件（依 package-lock.json 精確安裝）
set -e
cd "$(dirname "$0")/../.."
npm ci
echo 完成
