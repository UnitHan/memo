# build-msix.ps1
# AI 메모장 MSIX 패키지 빌드 스크립트
# 사용법: .\src-tauri\msix\build-msix.ps1
# 사전 조건: npm run dist 를 먼저 실행해 tauri-app.exe 가 생성된 상태여야 함

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT        = $PSScriptRoot | Split-Path -Parent | Split-Path -Parent  # c:\memo
$RELEASE_DIR = "$ROOT\src-tauri\target\release"
$APP_ICON    = "$ROOT\icon.png"   # ← 항상 이 파일 사용 (주황색 메모장 아이콘)
$MSIX_DIR    = "$ROOT\src-tauri\msix"
$STAGING     = "$MSIX_DIR\staging"
$STAGING_BIN = "$MSIX_DIR\staging\binaries"
$OUT_MSIX    = "$MSIX_DIR\AI-Memo_1.0.1_x64.msix"
$MAKEAPPX    = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\makeappx.exe"

Write-Host "=== AI 메모장 MSIX 빌드 시작 ===" -ForegroundColor Cyan

# ── 1. 기존 스테이징 폴더 초기화 ──
if (Test-Path $STAGING) { Remove-Item $STAGING -Recurse -Force }
New-Item -ItemType Directory -Path "$STAGING\Assets" | Out-Null
New-Item -ItemType Directory -Path "$STAGING_BIN" | Out-Null

# ── 2. 메인 EXE 복사 (Store 제출용 이름으로 변경) ──
Write-Host "[1/5] 앱 실행파일 복사..."
$srcExe = "$RELEASE_DIR\tauri-app.exe"
if (-not (Test-Path $srcExe)) {
    Write-Error "tauri-app.exe 가 없습니다. 먼저 'npm run dist' 를 실행하세요."
    exit 1
}
Copy-Item $srcExe "$STAGING\AI-Memo.exe"
Write-Host "      AI-Memo.exe ($([math]::Round((Get-Item "$STAGING\AI-Memo.exe").Length/1MB,1)) MB)" -ForegroundColor Green

# ── 3. 사이드카 (Python AI 코어) 복사 ──
Write-Host "[2/5] 사이드카 복사..."
$sidecar = "$RELEASE_DIR\gemini-corrector.exe"
if (Test-Path $sidecar) {
    Copy-Item $sidecar "$STAGING_BIN\gemini-corrector.exe"
    Write-Host "      binaries/gemini-corrector.exe 복사 완료" -ForegroundColor Green
} else {
    Write-Host "      [경고] release/ 에 없음 - binaries 폴더에서 탐색..." -ForegroundColor Yellow
    $sidecar2 = "$ROOT\src-tauri\binaries\gemini-corrector.exe"
    if (Test-Path $sidecar2) {
        Copy-Item $sidecar2 "$STAGING_BIN\gemini-corrector.exe"
        Write-Host "      binaries/ 에서 복사 완료" -ForegroundColor Green
    } else {
        Write-Host "      [경고] 사이드카 없음 - AI 교정 기능 미포함으로 진행" -ForegroundColor Yellow
    }
}

# ── 4. 아이콘 생성 (항상 c:\memo\icon.png 기반, 배경 구워 넣음) ──
Write-Host "[3/5] 아이콘 생성 중..."

# 원본 아이콘 검증
if (-not (Test-Path $APP_ICON)) {
    Write-Error "아이콘 파일을 찾을 수 없습니다: $APP_ICON"
    exit 1
}

Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Image]::FromFile($APP_ICON)
Write-Host "      원본 아이콘: $APP_ICON ($($icon.Width)x$($icon.Height))" -ForegroundColor Green

# 배경색 (icon.png 크림색과 동일)
$bg = [System.Drawing.Color]::FromArgb(255, 255, 248, 225)

function New-IconFile($path, $w, $h, $iconSize = -1) {
    if ($iconSize -lt 0) { $iconSize = [Math]::Min($w, $h) }
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear($bg)
    $x = [int](($w - $iconSize) / 2)
    $y = [int](($h - $iconSize) / 2)
    $g.DrawImage($icon, $x, $y, $iconSize, $iconSize)
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# 정사각형 타일 아이콘 (꽉 채움)
New-IconFile "$STAGING\Assets\Square44x44Logo.png"   44   44
New-IconFile "$STAGING\Assets\Square71x71Logo.png"   71   71
New-IconFile "$STAGING\Assets\Square150x150Logo.png" 150  150
New-IconFile "$STAGING\Assets\Square310x310Logo.png" 310  310
New-IconFile "$STAGING\Assets\StoreLogo.png"          50   50

# Wide 타일 (310x150, 아이콘을 세로 기준으로 가운데 배치)
New-IconFile "$STAGING\Assets\Wide310x150Logo.png"   310  150  150

# 스플래시 (620x300, 아이콘 300px 가운데 배치)
New-IconFile "$STAGING\Assets\SplashScreen.png"      620  300  300

$icon.Dispose()
Write-Host "      아이콘 7종 생성 완료 (소스: $APP_ICON)" -ForegroundColor Green

# ── 5. AppxManifest.xml 복사 ──
Write-Host "[4/5] AppxManifest.xml 복사..."
Copy-Item "$MSIX_DIR\AppxManifest.xml" "$STAGING\AppxManifest.xml"
Write-Host "      완료" -ForegroundColor Green

# ── 6. makeappx.exe 로 MSIX 패키징 ──
Write-Host "[5/5] MSIX 패키징 중..."
if (-not (Test-Path $MAKEAPPX)) {
    Write-Error "makeappx.exe 를 찾을 수 없습니다: $MAKEAPPX"
    exit 1
}

if (Test-Path $OUT_MSIX) { Remove-Item $OUT_MSIX -Force }

& $MAKEAPPX pack /d "$STAGING" /p "$OUT_MSIX" /nv /o
if ($LASTEXITCODE -ne 0) {
    Write-Error "makeappx 실패 (exit code: $LASTEXITCODE)"
    exit 1
}

$msixSize = [math]::Round((Get-Item $OUT_MSIX).Length / 1MB, 1)
Write-Host ""
Write-Host "=== ✅ MSIX 빌드 완료 ===" -ForegroundColor Green
Write-Host "출력 파일: $OUT_MSIX" -ForegroundColor Cyan
Write-Host "파일 크기: $msixSize MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "  MS 파트너 센터 → 패키지 탭 → .msix 파일 업로드"
