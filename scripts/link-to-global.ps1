<#
.SYNOPSIS
    my-pi-tools → ~/.pi/agent Windows 符号链接映射脚本

.DESCRIPTION
    将 my-pi-tools 项目中的目录/文件通过符号链接映射到 %USERPROFILE%\.pi\agent\，
    实现"在项目目录开发，全局即时生效"。

    映射关系：
      project\extensions\                  →  %USERPROFILE%\.pi\agent\extensions\
      project\skills\                      →  %USERPROFILE%\.pi\agent\skills\
      project\agents\                      →  %USERPROFILE%\.pi\agent\agents\
      config\keybindings.json              →  %USERPROFILE%\.pi\agent\keybindings.json
      config\subagent-tool-description.md  →  %USERPROFILE%\.pi\agent\subagent-tool-description.md

    注意：以下文件需手动复制（非符号链接）：
      config\settings.template.json        →  %USERPROFILE%\.pi\agent\settings.json

    权限要求：
    - 需要「以管理员身份运行」 或 启用 Windows 开发者模式
      （Windows 10/11 设置 → 更新和安全 → 开发者选项 → 开发者模式）

.PARAMETER Force
    跳过确认提示，直接执行。

.EXAMPLE
    .\scripts\link-to-global.ps1
    交互式运行，每一步都提示确认。

.EXAMPLE
    .\scripts\link-to-global.ps1 -Force
    静默执行，不提示确认。

.NOTES
    修改项目文件后，在 pi 中执行 /reload 热加载即可生效。
#>

param(
    [switch]$Force
)

# ── 路径 ──────────────────────────────────────────────────────────
# $PSScriptRoot = scripts/ 目录，往上一层就是项目根目录
$ProjectDir = Split-Path -Parent $PSScriptRoot
$PiAgentDir = Join-Path $env:USERPROFILE ".pi\agent"
$Timestamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir  = Join-Path $PiAgentDir ".backup\$Timestamp"

# ANSI 颜色（PowerShell 7+ 原生支持）
$Green  = "[32m"
$Yellow = "[33m"
$Cyan   = "[36m"
$Red    = "[31m"
$Reset  = "[0m"

function Write-Info  { Write-Host "${Cyan}→${Reset} $args" }
function Write-Ok    { Write-Host "${Green}✓${Reset} $args" }
function Write-Warn  { Write-Host "${Yellow}⚠${Reset} $args" }
function Write-Error { Write-Host "${Red}✗${Reset} $args" }

# ── 管理员/开发者模式检查 ─────────────────────────────────────────
function Test-SymlinkPrivilege {
    $testLink = Join-Path $env:TEMP "_pi_symlink_test_$PID"
    $testTarget = Join-Path $env:TEMP "_pi_symlink_target_$PID"
    try {
        # 创建一个临时目录作为目标
        $null = New-Item -ItemType Directory -Path $testTarget -Force -ErrorAction Stop
        # 尝试创建符号链接（-ErrorAction Stop 确保 try/catch 能捕获错误）
        $null = New-Item -ItemType SymbolicLink -Path $testLink -Target $testTarget -Force -ErrorAction Stop
        # 清理
        Remove-Item -Path $testLink -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $testTarget -Force -ErrorAction SilentlyContinue
        return $true
    } catch {
        # 清理
        Remove-Item -Path $testLink -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $testTarget -Force -ErrorAction SilentlyContinue
        return $false
    }
}

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ── 备份（仅非符号链接的实体文件/目录） ───────────────────────────
function Backup-Item {
    param([string]$Path)
    if (Test-Path $Path) {
        $item = Get-Item $Path -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            return  # 已经是符号链接或挂载点，跳过备份
        }
        # 是实体文件/目录，需要备份
        if (-not (Test-Path $BackupDir)) {
            New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
        }
        $dest = Join-Path $BackupDir (Split-Path $Path -Leaf)
        if (Test-Path $Path -PathType Container) {
            Copy-Item -Path $Path -Destination $dest -Recurse -Force
        } else {
            Copy-Item -Path $Path -Destination $dest -Force
        }
        Write-Warn "已备份 $Path → $BackupDir\"
    }
}

# ── 创建目录符号链接 ─────────────────────────────────────────────
function New-DirectoryLink {
    param(
        [string]$Source,  # 项目中的源目录
        [string]$Target   # 全局目标路径
    )

    if (-not (Test-Path $Source)) {
        Write-Warn "跳过：源目录不存在 $Source"
        return $false
    }

    $sourceRel = $Source.Substring($ProjectDir.Length + 1)
    $targetRel = $Target.Substring($PiAgentDir.Length + 1)

    # 检查现有链接
    if (Test-Path $Target) {
        $item = Get-Item $Target -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            $existing = (Get-Item $Target -Force).Target
            if ($existing -eq $Source) {
                Write-Ok "已存在（正确）：$targetRel ← $sourceRel"
                return $true
            }
            Write-Warn "链接指向别处：$targetRel → $existing"
        } else {
            Write-Warn "实体目录已存在：$targetRel"
        }
    }

    # 确认
    if (-not $Force) {
        $msg = "将要创建符号链接：$targetRel ← $sourceRel"
        if (Test-Path $Target) {
            $msg += "`n    现有项目将被备份到 $BackupDir"
        }
        $choice = Read-Host "${msg}`n    继续? [Y/n]"
        if ($choice -eq 'n' -or $choice -eq 'N') {
            Write-Warn "跳过：$targetRel"
            return $false
        }
    }

    # 备份并创建
    Backup-Item $Target
    if (Test-Path $Target) {
        Remove-Item -Path $Target -Recurse -Force
    }
    # 确保父目录存在
    $parent = Split-Path $Target -Parent
    if (-not (Test-Path $parent)) {
        $null = New-Item -ItemType Directory -Path $parent -Force -ErrorAction Stop
    }
    try {
        $null = New-Item -ItemType SymbolicLink -Path $Target -Target $Source -Force -ErrorAction Stop
        Write-Ok "链接：$targetRel ← $sourceRel"
        return $true
    } catch {
        # Fallback: 通过 cmd /c mklink 尝试（开发者模式下 mklink 可能比 PowerShell 更宽松）
        Write-Warn "PowerShell API 失败，尝试 mklink 回退…"
        $mklinkResult = & cmd /c mklink /D "$Target" "$Source" 2`>`&1
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "链接（mklink）：$targetRel ← $sourceRel"
            return $true
        }
        Write-Error "创建符号链接失败：$targetRel ← $sourceRel"
        Write-Error "  原因：$($_.Exception.Message)"
        Write-Warn "请以管理员身份运行或启用开发者模式"
        return $false
    }
}

# ── 创建文件符号链接 ─────────────────────────────────────────────
function New-FileLink {
    param(
        [string]$Source,  # 项目中的源文件
        [string]$Target   # 全局目标路径
    )

    if (-not (Test-Path $Source)) {
        Write-Warn "跳过：源文件不存在 $Source"
        return $false
    }

    $sourceRel = $Source.Substring($ProjectDir.Length + 1)
    $targetRel = $Target.Substring($PiAgentDir.Length + 1)

    # 检查现有链接
    if (Test-Path $Target) {
        $item = Get-Item $Target -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            $existing = (Get-Item $Target -Force).Target
            if ($existing -eq $Source) {
                Write-Ok "已存在（正确）：$targetRel ← $sourceRel"
                return $true
            }
            Write-Warn "链接指向别处：$targetRel → $existing"
        } else {
            Write-Warn "实体文件已存在：$targetRel"
        }
    }

    # 确认
    if (-not $Force) {
        $msg = "将要创建符号链接：$targetRel ← $sourceRel"
        if (Test-Path $Target) {
            $msg += "`n    现有文件将被备份到 $BackupDir"
        }
        $choice = Read-Host "${msg}`n    继续? [Y/n]"
        if ($choice -eq 'n' -or $choice -eq 'N') {
            Write-Warn "跳过：$targetRel"
            return $false
        }
    }

    # 备份并创建
    Backup-Item $Target
    if (Test-Path $Target) {
        Remove-Item -Path $Target -Force
    }
    # 确保父目录存在
    $parent = Split-Path $Target -Parent
    if (-not (Test-Path $parent)) {
        $null = New-Item -ItemType Directory -Path $parent -Force -ErrorAction Stop
    }
    try {
        $null = New-Item -ItemType SymbolicLink -Path $Target -Target $Source -Force -ErrorAction Stop
        Write-Ok "链接：$targetRel ← $sourceRel"
        return $true
    } catch {
        # Fallback: 通过 cmd /c mklink 尝试
        Write-Warn "PowerShell API 失败，尝试 mklink 回退…"
        $mklinkResult = & cmd /c mklink "$Target" "$Source" 2`>`&1
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "链接（mklink）：$targetRel ← $sourceRel"
            return $true
        }
        Write-Error "创建符号链接失败：$targetRel ← $sourceRel"
        Write-Error "  原因：$($_.Exception.Message)"
        Write-Warn "请以管理员身份运行或启用开发者模式"
        return $false
    }
}

# ══════════════════════════════════════════════════════════════════
#  主流程
# ══════════════════════════════════════════════════════════════════

# ── 权限检查 ──────────────────────────────────────────────────────
$hasAdmin = Test-Admin
$hasSymlinkPriv = Test-SymlinkPrivilege

if (-not $hasSymlinkPriv) {
    Write-Host ""
    Write-Error "当前进程没有创建符号链接的权限！"
    Write-Host ""
    Write-Host "请选择以下一种方式解决："
    Write-Host ""
    if (-not $hasAdmin) {
        Write-Host "  方式一：以管理员身份运行"
        Write-Host "    右键点击 PowerShell 图标，选择"以管理员身份运行""
        Write-Host "    或使用 link-to-global.bat（会自动请求管理员权限）"
        Write-Host ""
    }
    Write-Host "  方式二：启用 Windows 开发者模式"
    Write-Host "    Windows 10/11: 设置 → 更新和安全 → 开发者选项"
    Write-Host "    → 勾选"开发者模式""
    Write-Host ""
    Write-Host "  方式三：创建目录联接（Junction），但仅限同一驱动器"
    Write-Host "    运行: .\scripts\link-to-global-junction.ps1"
    Write-Host ""
    exit 1
}

if ($hasAdmin) {
    Write-Host ""
    Write-Host "${Cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${Reset}"
    Write-Host "   my-pi-tools → ~\.pi\agent 符号链接映射"
    Write-Host "   运行身份: 管理员 ✓"
    Write-Host "${Cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${Reset}"
} else {
    Write-Host ""
    Write-Host "${Cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${Reset}"
    Write-Host "   my-pi-tools → ~\.pi\agent 符号链接映射"
    Write-Host "   运行身份: 用户（依赖开发者模式）"
    Write-Host "${Cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${Reset}"
}

# ── 项目信息 ──────────────────────────────────────────────────────
Write-Host ""
Write-Info "项目路径: $ProjectDir"
Write-Info "目标路径: $PiAgentDir"
Write-Host ""

# ── 1. extensions/ ───────────────────────────────────────────────
Write-Info "extensions/ …"
New-DirectoryLink -Source (Join-Path $ProjectDir "extensions") -Target (Join-Path $PiAgentDir "extensions")

# ── 2. skills/ ───────────────────────────────────────────────────
Write-Info "skills/ …"
New-DirectoryLink -Source (Join-Path $ProjectDir "skills") -Target (Join-Path $PiAgentDir "skills")

# ── 3. agents/ ───────────────────────────────────────────────────
Write-Info "agents/ …"
New-DirectoryLink -Source (Join-Path $ProjectDir "agents") -Target (Join-Path $PiAgentDir "agents")

# ── 4. 独立文件 ──────────────────────────────────────────────────
Write-Info "keybindings.json …"
New-FileLink -Source (Join-Path $ProjectDir "config\keybindings.json") -Target (Join-Path $PiAgentDir "keybindings.json")

Write-Info "subagent-tool-description.md …"
New-FileLink -Source (Join-Path $ProjectDir "config\subagent-tool-description.md") -Target (Join-Path $PiAgentDir "subagent-tool-description.md")

# ── 完成 ─────────────────────────────────────────────────────────
Write-Host ""
Write-Ok "全部完成！"
Write-Info "执行 /reload 热加载扩展和技能"
Write-Host ""

if (Test-Path $BackupDir) {
    Write-Warn "备份文件位于：$BackupDir"
    Write-Warn "确认一切正常后可以手动删除该备份目录"
}

# ── 提示后续步骤 ──────────────────────────────────────────────────
Write-Host ""
Write-Host "${Cyan}── 后续步骤 ──────────────────────────────${Reset}"
if (-not (Test-Path (Join-Path $PiAgentDir "settings.json"))) {
    Write-Host "  1. 复制 settings.json（需要手动操作）："
    Write-Host "     Copy-Item '$ProjectDir\config\settings.template.json' '$PiAgentDir\settings.json'"
    Write-Host "     （注意：settings.json 不能使用符号链接，因为 pi 会写入该文件）"
}
Write-Host "  2. 启动 pi，它会自动安装 settings.json 中声明的 npm 包"
Write-Host "  3. 修改项目文件后，在 pi 中执行 /reload 即可热加载"
Write-Host "${Cyan}────────────────────────────────────────────${Reset}"
Write-Host ""
