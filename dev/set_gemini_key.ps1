# 같이가개(ggagae.com) - Gemini API 키 넣기
# 키를 Netlify(사이트 gachigagae) 환경변수 GEMINI_API_KEY 에 비밀값으로 저장한다.
# 키는 화면과 파일 어디에도 남지 않는다. 키를 새로 받았을 때도 이 창을 다시 쓰면 된다.
# 저장한 뒤에는 다시 배포해야 사이트에 반영된다.
#
#   powershell -ExecutionPolicy Bypass -File dev\set_gemini_key.ps1 [-StatusFile 상태파일.json]
param([string]$StatusFile = "")

$root = Split-Path -Parent $PSScriptRoot
Set-Location -Path $root
$keyPage = "https://aistudio.google.com/apikey"
$spendPage = "https://aistudio.google.com/spend"
$siteId = "33f0380a-7e91-4a4e-99e6-ffaa91c5a37f"  # gachigagae (ggagae.com)

# 상태 파일에는 결과만 남긴다 (키 값 없음).
function Write-Status([hashtable]$s) {
    if (-not $StatusFile) { return }
    $s.at = (Get-Date).ToString("s")
    [System.IO.File]::WriteAllText($StatusFile, ($s | ConvertTo-Json -Compress), [System.Text.UTF8Encoding]::new($false))
}

function Clean([string]$k) { return "$k".Trim().Trim('"').Trim("'").Trim() }
function Test-KeyShape([string]$k) { return $k -match '^[A-Za-z0-9._\-]{30,}$' }

function Set-Key([string]$value) {
    # 예전 값은 비밀값이 아니고 dev 컨텍스트까지 들어 있어 그대로는 비밀값으로 못 바꾼다 -> 지우고 새로 넣는다.
    netlify env:unset GEMINI_API_KEY --force --site $siteId 2>&1 | Out-Null
    netlify env:set GEMINI_API_KEY $value --secret --force --context production deploy-preview branch-deploy --site $siteId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { return "secret" }
    # 비밀값 저장이 막히면 일반 값으로라도 넣는다 (사이트가 키 없이 멈추지 않게)
    netlify env:set GEMINI_API_KEY $value --force --site $siteId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { return "plain" }
    return ""
}

# 키는 배포할 때 함수에 들어간다 -> 저장만 하면 사이트는 예전 키를 계속 쓴다. 저장 뒤 바로 다시 배포한다.
# 단, 아직 커밋하지 않은 수정이 폴더에 있으면 그것까지 운영에 나가므로 그때는 배포하지 않고 알려 준다.
function Publish-Site([hashtable]$status) {
    $dirty = git -C $root status --porcelain 2>$null
    if ($LASTEXITCODE -ne 0) { $status.deploy = "nogit"; return "nogit" }
    if ($dirty) { $status.deploy = "dirty"; return "dirty" }
    netlify deploy --prod --site $siteId --message "Gemini 키 교체 반영" 2>&1 | Out-Null
    $status.deploy = if ($LASTEXITCODE -eq 0) { "deployed" } else { "failed" }
    return $status.deploy
}
function Deploy-Message([string]$r) {
    switch ($r) {
        "deployed" { return "저장하고 사이트에 반영까지 끝났어요! 1~2분 뒤 AI 도우미가 새 키로 답합니다." }
        "dirty"    { return "키는 저장했어요. 폴더에 아직 올리지 않은 수정이 있어 자동 배포는 하지 않았어요 - Claude 에게 배포를 맡겨 주세요." }
        "nogit"    { return "키는 저장했어요. 사이트 반영(재배포)은 Claude 에게 맡겨 주세요." }
        default    { return "키는 저장했어요. 재배포에 실패했어요 - Claude 에게 배포를 맡겨 주세요." }
    }
}

function Save-Key([string]$key, [hashtable]$status) {
    $status.kind = if ($key.StartsWith("AIza")) { "AIza" } elseif ($key.StartsWith("AQ.")) { "AQ" } else { "other" }
    $status.length = $key.Length
    $mode = Set-Key $key
    $status.mode = $mode
    $status.ok = [bool]$mode
    return $status.ok
}

$status = @{ ok = $false }

# ── 1순위: 작은 창(붙여넣기 칸 + 저장 버튼) ─────────────────────────
$gui = $false
try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    $gui = $true
} catch { $gui = $false }

if ($gui) {
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "같이가개 - Gemini API 키 넣기"
    $form.Size = New-Object System.Drawing.Size(560, 300)
    $form.StartPosition = "CenterScreen"
    $form.TopMost = $true
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $font = New-Object System.Drawing.Font("Malgun Gothic", 10)
    $form.Font = $font

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = "구글 AI 키(AIza... 또는 AQ....)를 아래 칸에 붙여넣고 [저장]을 누르세요.`n키는 화면에 ●●● 로만 보이고, Netlify 에 비밀값으로만 저장됩니다."
    $lbl.Location = New-Object System.Drawing.Point(20, 18)
    $lbl.Size = New-Object System.Drawing.Size(510, 48)
    $form.Controls.Add($lbl)

    $box = New-Object System.Windows.Forms.TextBox
    $box.UseSystemPasswordChar = $true
    $box.Location = New-Object System.Drawing.Point(20, 74)
    $box.Size = New-Object System.Drawing.Size(390, 28)
    $form.Controls.Add($box)

    $paste = New-Object System.Windows.Forms.Button
    $paste.Text = "붙여넣기"
    $paste.Location = New-Object System.Drawing.Point(420, 72)
    $paste.Size = New-Object System.Drawing.Size(100, 30)
    $paste.Add_Click({
        try { $box.Text = Clean ([System.Windows.Forms.Clipboard]::GetText()) } catch {}
        if (-not $box.Text) { $msg.ForeColor = "Firebrick"; $msg.Text = "복사된 키가 없어요. 키를 먼저 Ctrl+C 로 복사해 주세요." }
        else { $msg.ForeColor = "DimGray"; $msg.Text = "붙여넣었어요 ($($box.Text.Length)자). [저장]을 누르세요." }
    })
    $form.Controls.Add($paste)

    $msg = New-Object System.Windows.Forms.Label
    $msg.Location = New-Object System.Drawing.Point(20, 112)
    $msg.Size = New-Object System.Drawing.Size(510, 44)
    $msg.ForeColor = "DimGray"
    $msg.Text = "칸을 누르고 Ctrl+V 로 붙여넣어도 됩니다."
    $form.Controls.Add($msg)

    $link = New-Object System.Windows.Forms.LinkLabel
    $link.Text = "새 키 만들기 (AI Studio 열기)"
    $link.Location = New-Object System.Drawing.Point(20, 165)
    $link.Size = New-Object System.Drawing.Size(260, 24)
    $link.Add_LinkClicked({ Start-Process $keyPage })
    $form.Controls.Add($link)

    $save = New-Object System.Windows.Forms.Button
    $save.Text = "저장"
    $save.Location = New-Object System.Drawing.Point(320, 200)
    $save.Size = New-Object System.Drawing.Size(100, 34)
    $form.Controls.Add($save)
    $form.AcceptButton = $save

    $close = New-Object System.Windows.Forms.Button
    $close.Text = "닫기"
    $close.Location = New-Object System.Drawing.Point(430, 200)
    $close.Size = New-Object System.Drawing.Size(90, 34)
    $close.Add_Click({ $form.Close() })
    $form.Controls.Add($close)

    $save.Add_Click({
        $key = Clean $box.Text
        if (-not (Test-KeyShape $key)) {
            $msg.ForeColor = "Firebrick"
            $msg.Text = "키 모양이 아니에요. AIza... 또는 AQ.... 로 시작하는 한 줄을 붙여넣어 주세요."
            return
        }
        $save.Enabled = $false; $paste.Enabled = $false
        $msg.ForeColor = "DimGray"; $msg.Text = "Netlify 에 저장하는 중... (10~20초)"
        $form.Refresh()
        try {
            if (Save-Key $key $status) {
                $box.Text = ""
                $msg.ForeColor = "DimGray"
                $msg.Text = "저장했어요. 사이트에 반영(재배포)하는 중... 1분쯤 걸려요. 창이 멈춘 것처럼 보여도 기다려 주세요."
                $form.Refresh()
                $r = Publish-Site $status
                $msg.ForeColor = if ($r -eq "deployed") { "ForestGreen" } else { "DarkOrange" }
                $msg.Text = Deploy-Message $r
                $close.Text = "완료 (닫기)"
                $close.Focus()
            } else {
                $msg.ForeColor = "Firebrick"
                $msg.Text = "저장하지 못했어요. Netlify 로그인이 풀렸을 수 있어요 (netlify login 후 다시)."
                $save.Enabled = $true; $paste.Enabled = $true
            }
        } catch {
            $status.error = $_.Exception.Message
            $msg.ForeColor = "Firebrick"; $msg.Text = "오류: $($_.Exception.Message)"
            $save.Enabled = $true; $paste.Enabled = $true
        }
        $key = ""
    })

    $form.Add_Shown({ $form.Activate(); $box.Focus() })
    [void]$form.ShowDialog()
    if (-not $status.ok -and -not $status.error) { $status.cancelled = $true }
    Write-Status $status
    return
}

# ── 2순위: 콘솔 입력 (창을 못 띄우는 환경) ──────────────────────────
try {
    Write-Host ""
    Write-Host "=== 같이가개 AI 도우미 - Gemini API 키 넣기 ===" -ForegroundColor Cyan
    Write-Host "키는 화면에 보이지 않고 Netlify 에 비밀값으로 저장됩니다. (입력해도 아무것도 안 보이는 게 정상)"
    Write-Host "키를 Ctrl+C 로 복사해 두었다면 c 만 입력하고 Enter. 그만두려면 q." -ForegroundColor DarkGray
    $key = ""
    while ($true) {
        $sec = Read-Host -AsSecureString "  키 붙여넣고 Enter (c=복사해 둔 키 쓰기, o=키 페이지 열기, q=그만두기)"
        $key = Clean ([System.Net.NetworkCredential]::new("", $sec).Password)
        if ($key -eq "q") { $key = ""; break }
        if ($key -eq "o") { Start-Process $keyPage; continue }
        if ($key -eq "c") {
            $key = Clean (Get-Clipboard -Raw)
            if (-not $key) { Write-Host "  복사된 키가 없어요. 키를 먼저 Ctrl+C 로 복사해 주세요." -ForegroundColor Red; continue }
        }
        if (-not $key) { Write-Host "  아무것도 입력되지 않았어요. 다시 해 주세요 (그만두려면 q)." -ForegroundColor Yellow; continue }
        if (-not (Test-KeyShape $key)) {
            Write-Host "  키 모양이 아닙니다 (AIza... 또는 AQ.... 로 시작하는 한 줄). 다시 복사해 주세요." -ForegroundColor Red
            $key = ""; continue
        }
        break
    }
    if (-not $key) { Write-Host "  아무것도 바꾸지 않았습니다." -ForegroundColor Yellow; $status.cancelled = $true; return }
    Write-Host "Netlify 에 저장하는 중..."
    $ok = Save-Key $key $status
    $key = ""
    if ($ok) {
        Write-Host "저장했습니다. 사이트에 반영(재배포)하는 중... 1분쯤 걸립니다."
        $r = Publish-Site $status
        Write-Host (Deploy-Message $r) -ForegroundColor $(if ($r -eq "deployed") { "Green" } else { "Yellow" })
    }
    else { Write-Host "저장하지 못했습니다. Netlify 로그인이 풀렸으면 netlify login 후 다시 실행해 주세요." -ForegroundColor Red }
    Write-Host "(같은 구글 프로젝트의 키라면 월 지출 한도도 확인해 주세요: $spendPage)" -ForegroundColor DarkGray
} catch {
    Write-Host "오류: $($_.Exception.Message)" -ForegroundColor Red
    $status.error = $_.Exception.Message
} finally {
    Write-Status $status
    Read-Host "`n끝났습니다. Enter 를 누르면 창이 닫힙니다" | Out-Null
}
