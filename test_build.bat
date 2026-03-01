@echo off
cd /d K:\happybigbomb
call npm run build > build_output.txt 2>&1
type build_output.txt
