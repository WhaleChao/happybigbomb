@echo off
cd /d K:\happybigbomb

echo === GIT STATUS ===
git status

echo.
echo === NPM BUILD ===
call npm run build

echo.
echo === DONE ===
