@echo off
chcp 65001 >nul
rem 本機完整檢查：git 狀態、lint、單元測試、建置
cd /d "%~dp0..\.."
echo === GIT STATUS ===
git status
echo.
echo === LINT ===
call npm run lint || goto :fail
echo === TEST ===
call npm test || goto :fail
echo === BUILD ===
call npm run build || goto :fail
call npm run check:static || goto :fail
echo.
echo === 全部通過 ===
pause
exit /b 0
:fail
echo.
echo === 有步驟失敗，請看上方訊息 ===
pause
exit /b 1
