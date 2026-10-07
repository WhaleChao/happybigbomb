@echo off
chcp 65001 >nul
rem 安裝相依套件（依 package-lock.json 精確安裝）
cd /d "%~dp0..\.."
call npm ci
if errorlevel 1 (echo npm ci 失敗 & pause & exit /b 1)
echo 完成
pause
