#!/bin/zsh
# 只建置，輸出存到 build_output.txt
cd "$(dirname "$0")/../.."
npm run build > build_output.txt 2>&1
cat build_output.txt
