@echo off
echo Committing and Deploying updates to happybigbomb...

cd /d K:\happybigbomb

echo 1. Committing source code...
git add .
git commit -m "feat: Add mobile live preview UI and draggable grid cells"
git push origin main

echo 2. Building and Deploying to GitHub Pages...
call npm run deploy

echo Done!
pause
