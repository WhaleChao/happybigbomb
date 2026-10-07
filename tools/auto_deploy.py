"""跨平台（Windows／macOS）提交並推送到 main。

推送後由 GitHub Actions（.github/workflows/deploy.yml）自動 lint、測試、建置並部署到
GitHub Pages，所以這裡不再呼叫舊的 `npm run deploy`。

用法：python tools/auto_deploy.py "提交說明"
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def run(*cmd: str) -> bool:
    exe = shutil.which(cmd[0]) or cmd[0]  # Windows 上 npm 是 npm.cmd，用 which 找到實際檔案
    print("執行：", " ".join(cmd), flush=True)
    return subprocess.run([exe, *cmd[1:]], cwd=REPO).returncode == 0


def main() -> int:
    message = " ".join(sys.argv[1:]).strip() or "update"
    for step in (("npm", "run", "lint"), ("npm", "test"), ("npm", "run", "build")):
        if not run(*step):
            print("本機檢查失敗，未推送")
            return 1
    run("git", "add", "-A")
    run("git", "commit", "-m", message)  # 沒有變更時 commit 會失敗，仍繼續 push
    if not run("git", "push", "origin", "main"):
        print("推送失敗")
        return 1
    print("完成：部署進度請看 GitHub 的 Actions 頁面")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
