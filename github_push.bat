@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ==============================
echo GitHubへ変更を送信します
echo ==============================

set /p MESSAGE=変更内容を入力してください: 

if "%MESSAGE%"=="" (
    echo 変更内容が入力されていません。
    pause
    exit /b 1
)

git add .

git diff --cached --quiet
if %errorlevel%==0 (
    echo.
    echo 送信する変更がありません。
    pause
    exit /b 0
)

git commit -m "%MESSAGE%"
if errorlevel 1 (
    echo.
    echo コミットに失敗しました。
    pause
    exit /b 1
)

git push
if errorlevel 1 (
    echo.
    echo GitHubへの送信に失敗しました。
    pause
    exit /b 1
)

echo.
echo GitHubへの送信が完了しました。
pause