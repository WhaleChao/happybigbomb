@echo off
chcp 65001 >nul
rem 只建置，輸出存到 build_output.txt
cd /d "%~dp0..\.."
call npm run build > build_output.txt 2>&1
type build_output.txt
