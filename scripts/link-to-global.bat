@echo off
chcp 65001 >nul
title my-pi-tools → ~\.pi\agent 符号链接映射

:: ── 检查管理员权限 ──────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ⚠ 需要管理员权限才能创建符号链接。
    echo 正在自动请求管理员权限…
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: ═══════════════════════════════════════════════════════════════
::  主流程
:: ═══════════════════════════════════════════════════════════════
setlocal enabledelayedexpansion

:: 定位项目目录（脚本所在目录的上一级）
set "SCRIPT_DIR=%~dp0"
for %%i in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fi"

:: 目标路径
set "PI_AGENT_DIR=%USERPROFILE%\.pi\agent"

:: 备份目录（时间戳，通过 PowerShell 获取以防 wmic 不可用）
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd-HHmmss'"') do set "TS=%%I"
set "BACKUP_DIR=%PI_AGENT_DIR%\.backup\%TS%"

echo.
echo ┌────────────────────────────────────────────────────────────┐
echo │  my-pi-tools → ~\.pi\agent 符号链接映射                    │
echo │  运行身份: 管理员                                         │
echo └────────────────────────────────────────────────────────────┘
echo.
echo  项目路径: %PROJECT_DIR%
echo  目标路径: %PI_AGENT_DIR%
echo.

:: ── 1. extensions/ ───────────────────────────────────────────
echo ---
echo [1/5] extensions/
call :link_dir "%PROJECT_DIR%\extensions" "%PI_AGENT_DIR%\extensions"

:: ── 2. skills/ ───────────────────────────────────────────────
echo ---
echo [2/5] skills/
call :link_dir "%PROJECT_DIR%\skills" "%PI_AGENT_DIR%\skills"

:: ── 3. agents/ ───────────────────────────────────────────────
echo ---
echo [3/5] agents/
call :link_dir "%PROJECT_DIR%\agents" "%PI_AGENT_DIR%\agents"

:: ── 4. keybindings.json ──────────────────────────────────────
echo ---
echo [4/5] keybindings.json
call :link_file "%PROJECT_DIR%\config\keybindings.json" "%PI_AGENT_DIR%\keybindings.json"

:: ── 5. subagent-tool-description.md ──────────────────────────
echo ---
echo [5/5] subagent-tool-description.md
call :link_file "%PROJECT_DIR%\config\subagent-tool-description.md" "%PI_AGENT_DIR%\subagent-tool-description.md"

:: ── 完成 ──────────────────────────────────────────────────────
echo ---
echo.
echo ✓ 全部完成！
if exist "%BACKUP_DIR%" (
    echo ⚠ 备份文件位于: %BACKUP_DIR%
    echo   确认一切正常后可以手动删除该备份目录
)
echo.
echo 后续步骤:
if not exist "%PI_AGENT_DIR%\settings.json" (
    echo  1. 复制 settings.json ^(需手动操作^):
    echo     copy "%PROJECT_DIR%\config\settings.template.json" "%PI_AGENT_DIR%\settings.json"
    echo     ^(注意: settings.json 不能使用符号链接，因为 pi 会写入该文件^)
)
echo  2. 启动 pi，它会自动安装 settings.json 中声明的 npm 包
echo  3. 修改项目文件后，在 pi 中执行 /reload 即可热加载
echo.
pause
exit /b

:: ═══════════════════════════════════════════════════════════════
::  子函数：创建目录符号链接
:: ═══════════════════════════════════════════════════════════════
:link_dir
set "SRC=%~1"
set "TGT=%~2"

:: 检查源是否存在
if not exist "%SRC%" (
    echo  ⚠ 跳过：源目录不存在 %SRC%
    exit /b 1
)

:: 提取相对路径用于显示
set "SRC_REL="
for %%i in ("%SRC%") do set "SRC_NAME=%%~nxi"
for %%i in ("%TGT%") do set "TGT_NAME=%%~nxi"

:: 检查现有目标
if exist "%TGT%" (
    :: 使用 fsutil 判断是否为重解析点（符号链接/挂载点）
    fsutil reparsepoint query "%TGT%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo  → 符号链接已存在，将删除重建
    ) else (
        echo  → 实体目录已存在，将备份后替换
        call :backup "%TGT%"
    )
    rmdir /s /q "%TGT%" 2>nul
    if exist "%TGT%" (
        echo  ✗ 无法删除 %TGT%，请检查文件权限
        exit /b 1
    )
) else (
    :: 确保父目录存在
    for %%i in ("%TGT%\..") do if not exist "%%~fi" mkdir "%%~fi"
)

:: 创建目录符号链接
mklink /D "%TGT%" "%SRC%" >nul
if !errorlevel! equ 0 (
    echo  ✓ %TGT_NAME% ← ..\%SRC_NAME%
) else (
    echo  ✗ 创建失败！请以管理员身份运行或启用开发者模式。
)
exit /b 0

:: ═══════════════════════════════════════════════════════════════
::  子函数：创建文件符号链接
:: ═══════════════════════════════════════════════════════════════
:link_file
set "SRC=%~1"
set "TGT=%~2"

:: 检查源是否存在
if not exist "%SRC%" (
    echo  ⚠ 跳过：源文件不存在 %SRC%
    exit /b 1
)

:: 提取相对路径用于显示
set "SRC_REL="
for %%i in ("%SRC%") do set "SRC_NAME=%%~nxi"
for %%i in ("%TGT%") do set "TGT_NAME=%%~nxi"

:: 检查现有目标
if exist "%TGT%" (
    :: 使用 fsutil 判断是否为重解析点（符号链接）
    fsutil reparsepoint query "%TGT%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo  → 符号链接已存在，将删除重建
    ) else (
        echo  → 实体文件已存在，将备份后替换
        call :backup "%TGT%"
    )
    del /f /q "%TGT%" 2>nul
    if exist "%TGT%" (
        echo  ✗ 无法删除 %TGT%，请检查文件权限
        exit /b 1
    )
) else (
    :: 确保父目录存在
    for %%i in ("%TGT%\..") do if not exist "%%~fi" mkdir "%%~fi"
)

:: 创建文件符号链接
mklink "%TGT%" "%SRC%" >nul
if !errorlevel! equ 0 (
    echo  ✓ %TGT_NAME% ← ..\%SRC_NAME%
) else (
    echo  ✗ 创建失败！请以管理员身份运行或启用开发者模式。
)
exit /b 0

:: ═══════════════════════════════════════════════════════════════
::  子函数：备份文件/目录到备份目录
:: ═══════════════════════════════════════════════════════════════
:backup
set "ITEM=%~1"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
for %%i in ("%ITEM%") do set "ITEM_NAME=%%~nxi"
if exist "%ITEM%" (
    copy "%ITEM%" "%BACKUP_DIR%\%ITEM_NAME%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo   → 已备份 %ITEM_NAME% → %BACKUP_DIR%\
    ) else (
        echo   → 尝试用 robocopy 备份目录...
        robocopy "%ITEM%" "%BACKUP_DIR%\%ITEM_NAME%" /E /NJH /NJS /NDL >nul 2>&1
    )
)
exit /b 0
