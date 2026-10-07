@echo off
chcp 65001 >nul
rem 提交並推送到 main；推送後 GitHub Actions 會自動檢查並部署到 GitHub Pages
cd /d "%~dp0..\.."
set "MSG=%*"
if "%MSG%"=="" set /p MSG=提交說明：
if "%MSG%"=="" set "MSG=update"
echo 1. 本機檢查...
call npm run lint || goto :fail
call npm test || goto :fail
call npm run build || goto :fail
echo 2. 提交並推送...
git add -A
git commit -m "%MSG%"
git push origin main || goto :fail
echo 完成：部署進度請看 GitHub 的 Actions 頁面
pause
exit /b 0
:fail
echo 失敗，未推送
pause
exit /b 1
