# Renders app/design/*.svg into app/public/icons (D48). Run it by hand when the icon changes and
# commit the PNGs: Vercel builds on Linux and never runs this. Needs only Edge and System.Drawing.
#   powershell -ExecutionPolicy Bypass -File app/scripts/make-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$app  = Split-Path -Parent $PSScriptRoot
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
          "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found' }
$work = Join-Path $env:TEMP 'omb-icons'
New-Item -ItemType Directory -Force $work, (Join-Path $app 'public\icons') | Out-Null

# The SVG is 1024x1024. Edge shoots a slightly bigger, transparent window and we crop the icon
# out of its corner, so the window-size quirks of new headless can't shift or shrink it.
function Render([string]$svg) {
  $png = Join-Path $work ([IO.Path]::ChangeExtension($svg, 'png'))
  Remove-Item $png -ErrorAction SilentlyContinue
  $url = ([Uri](Join-Path $app "design\$svg")).AbsoluteUri
  Start-Process -FilePath $edge -Wait -ArgumentList @('--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', "--user-data-dir=$work\profile", '--force-device-scale-factor=1',
    '--default-background-color=00000000', '--window-size=1100,1100', "--screenshot=$png", $url)
  if (-not (Test-Path $png)) { throw "Edge rendered nothing for $svg" }
  $shot = [Drawing.Bitmap]::FromFile($png)
  try {
    if ($shot.Width -lt 1024 -or $shot.Height -lt 1024) { throw "$svg came out $($shot.Width)x$($shot.Height)" }
    return $shot.Clone([Drawing.Rectangle]::new(0, 0, 1024, 1024), [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  } finally { $shot.Dispose() }
}

function Save([Drawing.Bitmap]$src, [int]$size, [string]$name, [switch]$Opaque) {
  $out = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
  $g.CompositingQuality = 'HighQuality'; $g.SmoothingMode = 'HighQuality'
  if ($Opaque) { $g.Clear([Drawing.ColorTranslator]::FromHtml('#161009')) }   # iOS turns transparency black
  $wrap = [Drawing.Imaging.ImageAttributes]::new(); $wrap.SetWrapMode('TileFlipXY')  # no faint edge from bicubic
  $g.DrawImage($src, [Drawing.Rectangle]::new(0, 0, $size, $size), 0, 0, $src.Width, $src.Height, 'Pixel', $wrap)
  $g.Dispose(); $out.Save((Join-Path $app "public\icons\$name"), [Drawing.Imaging.ImageFormat]::Png); $out.Dispose()
}

$tile = Render 'icon.svg'; $full = Render 'icon-full.svg'
Save $tile 512 'icon-512.png'; Save $tile 192 'icon-192.png'; Save $tile 32 'favicon-32.png'
Save $full 512 'icon-maskable-512.png' -Opaque; Save $full 180 'apple-touch-icon.png' -Opaque
$tile.Dispose(); $full.Dispose()
Copy-Item (Join-Path $app 'design\icon.svg') (Join-Path $app 'public\favicon.svg') -Force
Get-ChildItem (Join-Path $app 'public\icons') | ForEach-Object { "$($_.Name)  $($_.Length) bytes" }
