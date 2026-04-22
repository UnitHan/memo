# sign-msix.ps1
# MSIX 자체 서명 스크립트 (로컬 테스트용)
# 관리자 권한 필요 (인증서 신뢰 저장소 등록)
# 사용법: .\src-tauri\msix\sign-msix.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$MSIX_DIR   = "$PSScriptRoot"
$MSIX_FILE  = "$MSIX_DIR\AI-Memo_1.1.0_x64.msix"
$CERT_PFX   = "$MSIX_DIR\test-cert.pfx"
$CERT_CER   = "$MSIX_DIR\test-cert.cer"
$CERT_PASS  = "testpass123"
$SIGNTOOL   = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"

# Publisher는 AppxManifest.xml 과 반드시 일치해야 함
$PUBLISHER  = "CN=DBF2708E-1A7A-45A4-922A-4B40C76E2C11"

# ── 관리자 권한 확인 ──
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Error "관리자 권한으로 실행해야 합니다. PowerShell을 '관리자로 실행'하세요."
    exit 1
}

# ── MSIX 파일 존재 확인 ──
if (-not (Test-Path $MSIX_FILE)) {
    Write-Error "MSIX 파일이 없습니다: $MSIX_FILE`n먼저 build-msix.ps1 을 실행하세요."
    exit 1
}

Write-Host "=== MSIX 자체 서명 시작 ===" -ForegroundColor Cyan

# ── 1. 자체 서명 인증서 생성 (이미 있으면 재사용) ──
Write-Host "[1/4] 자체 서명 인증서 생성..."
$existingCert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $PUBLISHER } | Select-Object -First 1

if ($existingCert) {
    Write-Host "      기존 인증서 재사용: $($existingCert.Thumbprint)" -ForegroundColor Green
    $cert = $existingCert
} else {
    $cert = New-SelfSignedCertificate `
        -Type Custom `
        -Subject $PUBLISHER `
        -KeyUsage DigitalSignature `
        -FriendlyName "AI-Memo Test Signing" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
    Write-Host "      새 인증서 생성: $($cert.Thumbprint)" -ForegroundColor Green
}

# ── 2. PFX 내보내기 (signtool용) ──
Write-Host "[2/4] PFX 파일 내보내기..."
$securePass = ConvertTo-SecureString $CERT_PASS -AsPlainText -Force
Export-PfxCertificate -Cert $cert -FilePath $CERT_PFX -Password $securePass -Force | Out-Null

# CER 내보내기 (신뢰 저장소 등록용)
Export-Certificate -Cert $cert -FilePath $CERT_CER -Force | Out-Null
Write-Host "      완료: $CERT_PFX" -ForegroundColor Green

# ── 3. 인증서를 신뢰할 수 있는 루트 + TrustedPeople 에 등록 ──
Write-Host "[3/4] 인증서 신뢰 저장소 등록..."
$rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$rootStore.Open("ReadWrite")
$rootStore.Add($cert)
$rootStore.Close()

$peopleStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPeople", "LocalMachine")
$peopleStore.Open("ReadWrite")
$peopleStore.Add($cert)
$peopleStore.Close()
Write-Host "      Trusted Root + TrustedPeople 등록 완료" -ForegroundColor Green

# ── 4. signtool 로 MSIX 서명 ──
Write-Host "[4/4] MSIX 서명 중..."
if (-not (Test-Path $SIGNTOOL)) {
    # signtool 위치 자동 탐색
    $found = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue |
             Where-Object { $_.FullName -match "x64" } | Select-Object -First 1
    if ($found) {
        $SIGNTOOL = $found.FullName
    } else {
        Write-Error "signtool.exe 를 찾을 수 없습니다. Windows SDK가 설치되어 있는지 확인하세요."
        exit 1
    }
}

& $SIGNTOOL sign `
    /fd SHA256 `
    /a `
    /f "$CERT_PFX" `
    /p $CERT_PASS `
    /tr http://timestamp.digicert.com `
    /td SHA256 `
    "$MSIX_FILE" 2>&1

if ($LASTEXITCODE -ne 0) {
    # 타임스탬프 서버 실패 시 타임스탬프 없이 재시도
    Write-Host "      타임스탬프 서버 실패 - 타임스탬프 없이 재시도..." -ForegroundColor Yellow
    & $SIGNTOOL sign `
        /fd SHA256 `
        /a `
        /f "$CERT_PFX" `
        /p $CERT_PASS `
        "$MSIX_FILE" 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Error "서명 실패 (exit code: $LASTEXITCODE)"
        exit 1
    }
}

Write-Host ""
Write-Host "=== ✅ 서명 완료 ===" -ForegroundColor Green
Write-Host "서명된 파일: $MSIX_FILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "이제 개발자 모드 없이 설치할 수 있습니다." -ForegroundColor Yellow
Write-Host "더블클릭 또는 아래 명령으로 설치:" -ForegroundColor Yellow
Write-Host "  Add-AppxPackage `"$MSIX_FILE`"" -ForegroundColor White
