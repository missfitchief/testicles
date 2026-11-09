[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$source=Join-Path $project 'dist'
$release='C:\ProgramData\Testicles\releases\20261108-201810-testicles'
$proxy='C:\ProgramData\CALLR\app\Caddyfile'
$configuration=[IO.File]::ReadAllText($proxy)
if(-not $configuration.Contains('testicles.84.32.214.33.sslip.io') -or -not $configuration.Contains($release.Replace('\','/'))){throw 'The expected dedicated Testicles release is not active.'}
if(-not (Test-Path -LiteralPath (Join-Path $source 'index.html'))){throw 'Build the site before publishing.'}
if(Get-ChildItem -LiteralPath $source -Recurse | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}){throw 'The build contains a reparse point.'}
$proxyHash=(Get-FileHash -LiteralPath $proxy).Hash
foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File | Where-Object Name -ne 'index.html'){
  $relative=$file.FullName.Substring($source.Length+1)
  $destination=Join-Path $release $relative
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
  if((Get-FileHash -LiteralPath $destination).Hash -ne (Get-FileHash -LiteralPath $file.FullName).Hash){throw "Published file mismatch: $relative"}
}
if((Get-FileHash -LiteralPath $proxy).Hash -ne $proxyHash){throw 'Proxy configuration changed during publication.'}
$index=Join-Path $release 'index.html'
$pending=Join-Path $release 'index.rebuild-next.html'
$backup=Join-Path $project '.project-state/index-before-rebuild.html'
Copy-Item -LiteralPath $index -Destination $backup -Force
Copy-Item -LiteralPath (Join-Path $source 'index.html') -Destination $pending -Force
[IO.File]::Replace($pending,$index,(Join-Path $project ('.project-state/index-replaced-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'.html')))
$receipt=@{status='published';utc=[DateTime]::UtcNow.ToString('o');url='https://testicles.84.32.214.33.sslip.io/';indexSha256=(Get-FileHash -LiteralPath $index).Hash;servicesRestarted=@()}
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $project '.project-state/server-deployment.json')
$receipt | ConvertTo-Json
