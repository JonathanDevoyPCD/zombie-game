param(
  [string]$Root = (Resolve-Path ".").Path,
  [int]$GrassMax = 112,
  [int]$RockMax = 112,
  [int]$SpriteSize = 160,
  [int]$BottomPadding = 8,
  [byte]$AlphaThreshold = 8
)

Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class AlphaBounds {
  public static Rectangle Find(Bitmap bitmap, byte threshold) {
    Rectangle rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
    BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    try {
      int stride = Math.Abs(data.Stride);
      int bytes = stride * bitmap.Height;
      byte[] buffer = new byte[bytes];
      Marshal.Copy(data.Scan0, buffer, 0, bytes);

      int minX = bitmap.Width;
      int minY = bitmap.Height;
      int maxX = -1;
      int maxY = -1;

      for (int y = 0; y < bitmap.Height; y++) {
        int row = y * stride;
        for (int x = 0; x < bitmap.Width; x++) {
          byte alpha = buffer[row + x * 4 + 3];
          if (alpha > threshold) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < minX || maxY < minY) {
        return Rectangle.Empty;
      }
      return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
    } finally {
      bitmap.UnlockBits(data);
    }
  }
}
"@ -ReferencedAssemblies "System.Drawing"

function Optimize-Folder {
  param(
    [string]$Source,
    [string]$Destination,
    [int]$MaxDimension,
    [string]$Kind
  )

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  $results = @()
  $files = Get-ChildItem -Path $Source -File -Filter *.png | Sort-Object Name

  foreach ($file in $files) {
    $bitmap = [System.Drawing.Bitmap]::FromFile($file.FullName)
    try {
      $bounds = [AlphaBounds]::Find($bitmap, $AlphaThreshold)
      if ($bounds.IsEmpty) {
        Write-Warning "Skipping empty transparent image: $($file.Name)"
        continue
      }

      $scale = [Math]::Min($MaxDimension / $bounds.Width, $MaxDimension / $bounds.Height)
      if ($scale -gt 1) { $scale = 1 }
      $width = [Math]::Max(1, [int][Math]::Round($bounds.Width * $scale))
      $height = [Math]::Max(1, [int][Math]::Round($bounds.Height * $scale))

      $output = New-Object System.Drawing.Bitmap $SpriteSize, $SpriteSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($output)
        try {
          $graphics.Clear([System.Drawing.Color]::Transparent)
          $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
          $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

          $destX = [int][Math]::Round(($SpriteSize - $width) / 2)
          $destY = [int][Math]::Max(0, $SpriteSize - $height - $BottomPadding)
          $destRect = New-Object System.Drawing.Rectangle $destX, $destY, $width, $height
          $graphics.DrawImage($bitmap, $destRect, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height, [System.Drawing.GraphicsUnit]::Pixel)
        } finally {
          $graphics.Dispose()
        }

        $outPath = Join-Path $Destination $file.Name
        $output.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

        $results += [pscustomobject]@{
          kind = $Kind
          source = $file.FullName.Replace($Root + [System.IO.Path]::DirectorySeparatorChar, "")
          output = $outPath.Replace($Root + [System.IO.Path]::DirectorySeparatorChar, "")
          originalWidth = $bitmap.Width
          originalHeight = $bitmap.Height
          trimX = $bounds.X
          trimY = $bounds.Y
          trimWidth = $bounds.Width
          trimHeight = $bounds.Height
          contentX = $destX
          contentY = $destY
          contentWidth = $width
          contentHeight = $height
          outputWidth = $SpriteSize
          outputHeight = $SpriteSize
        }
      } finally {
        $output.Dispose()
      }
    } finally {
      $bitmap.Dispose()
    }
  }

  return $results
}

$grassSource = Join-Path $Root "sprites\Grass"
$rockSource = Join-Path $Root "sprites\Rocks"
$outRoot = Join-Path $Root "sprites\TerrainOptimized"
$grassOut = Join-Path $outRoot "Grass"
$rockOut = Join-Path $outRoot "Rocks"

if (!(Test-Path $grassSource)) { throw "Missing source folder: $grassSource" }
if (!(Test-Path $rockSource)) { throw "Missing source folder: $rockSource" }

$manifest = @()
$manifest += Optimize-Folder -Source $grassSource -Destination $grassOut -MaxDimension $GrassMax -Kind "grass"
$manifest += Optimize-Folder -Source $rockSource -Destination $rockOut -MaxDimension $RockMax -Kind "rock"

$manifestPath = Join-Path $outRoot "manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

$sourceSize = (Get-ChildItem -Path $grassSource,$rockSource -File -Filter *.png | Measure-Object Length -Sum).Sum
$outputSize = (Get-ChildItem -Path $grassOut,$rockOut -File -Filter *.png | Measure-Object Length -Sum).Sum

[pscustomobject]@{
  optimizedFiles = $manifest.Count
  sourceMb = [Math]::Round($sourceSize / 1MB, 2)
  outputMb = [Math]::Round($outputSize / 1MB, 2)
  outputFolder = $outRoot
  manifest = $manifestPath
}
