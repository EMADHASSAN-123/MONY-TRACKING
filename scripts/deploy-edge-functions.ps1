# نشر جميع Edge Functions لمشروع MONY على Supabase
# المتطلبات: Supabase CLI مثبت، وتنفيذ `supabase login` ثم `supabase link --project-ref <ref>` من جذر المشروع
# التشغيل من PowerShell:  .\scripts\deploy-edge-functions.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$names = @(
  "transactions",
  "expenses",
  "reports",
  "admin-users"
)

Write-Host "Deploying Edge Functions from: $root" -ForegroundColor Cyan
foreach ($name in $names) {
  Write-Host "`n>>> supabase functions deploy $name" -ForegroundColor Yellow
  supabase functions deploy $name
  if ($LASTEXITCODE -ne 0) { throw "Deploy failed: $name" }
}
Write-Host "`nDone. All functions deployed." -ForegroundColor Green
