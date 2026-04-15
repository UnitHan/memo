# build-msix.ps1
# AI 메모장 MSIX 패키지 빌드 스크립트
# 사용법: .\src-tauri\msix\build-msix.ps1
# 사전 조건: npm run dist 를 먼저 실행해 tauri-app.exe 가 생성된 상태여야 함

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT        = $PSScriptRoot | Split-Path -Parent | Split-Path -Parent  # c:\memo
$RELEASE_DIR = "$ROOT\src-tauri\target\release"
$ICONS_DIR   = "$ROOT\src-tauri\icons"
$MSIX_DIR    = "$ROOT\src-tauri\msix"
$STAGING     = "$MSIX_DIR\staging"
$STAGING_BIN = "$MSIX_DIR\staging\binaries"
$OUT_MSIX    = "$MSIX_DIR\AI-Memo_1.1.0_x64.msix"
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

# ── 4. 아이콘 파일 복사 + 누락 아이콘 생성 ──
Write-Host "[3/5] 아이콘 파일 준비..."

# 기본 아이콘 복사 (Store에서 요구하는 파일들)
$iconMap = @{
    "Square44x44Logo.png"   = "Square44x44Logo.png"
    "Square71x71Logo.png"   = "Square71x71Logo.png"
    "Square150x150Logo.png" = "Square150x150Logo.png"
    "Square310x310Logo.png" = "Square310x310Logo.png"
    "StoreLogo.png"         = "StoreLogo.png"
}
foreach ($src in $iconMap.Keys) {
    $srcPath = "$ICONS_DIR\$src"
    if (Test-Path $srcPath) {
        Copy-Item $srcPath "$STAGING\Assets\$($iconMap[$src])"
    }
}

# Wide310x150Logo.png 생성 (없으면 Square150x150Logo 에서 좌우 패딩)
$wideLogo = "$STAGING\Assets\Wide310x150Logo.png"
if (-not (Test-Path $wideLogo)) {
    Write-Host "      Wide310x150Logo.png 생성 중 (Add-Type 방식)..." -ForegroundColor Yellow
    Add-Type -AssemblyName System.Drawing
    $src150 = [System.Drawing.Image]::FromFile("$ICONS_DIR\Square150x150Logo.png")
    $wide = New-Object System.Drawing.Bitmap(310, 150)
    $g = [System.Drawing.Graphics]::FromImage($wide)
    $g.Clear([System.Drawing.Color]::Transparent)
    # 가운데 정렬로 150x150 배치
    $x = [int]((310 - 150) / 2)
    $g.DrawImage($src150, $x, 0, 150, 150)
    $g.Dispose()
    $src150.Dispose()
    $wide.Save($wideLogo, [System.Drawing.Imaging.ImageFormat]::Png)
    $wide.Dispose()
    Write-Host "      Wide310x150Logo.png 생성 완료" -ForegroundColor Green
}

# SplashScreen.png 생성 (620x300, 가운데 아이콘)
$splash = "$STAGING\Assets\SplashScreen.png"
if (-not (Test-Path $splash)) {
    Write-Host "      SplashScreen.png 생성 중..." -ForegroundColor Yellow
    Add-Type -AssemblyName System.Drawing
    $srcIcon = [System.Drawing.Image]::FromFile("$ICONS_DIR\Square310x310Logo.png")
    $splashImg = New-Object System.Drawing.Bitmap(620, 300)
    $g = [System.Drawing.Graphics]::FromImage($splashImg)
    $g.Clear([System.Drawing.Color]::FromArgb(255, 21, 101, 192))  # #1565C0
    $x = [int]((620 - 200) / 2)
    $y = [int]((300 - 200) / 2)
    $g.DrawImage($srcIcon, $x, $y, 200, 200)
    $g.Dispose()
    $srcIcon.Dispose()
    $splashImg.Save($splash, [System.Drawing.Imaging.ImageFormat]::Png)
    $splashImg.Dispose()
    Write-Host "      SplashScreen.png 생성 완료" -ForegroundColor Green
}

Write-Host "      아이콘 준비 완료" -ForegroundColor Green

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
