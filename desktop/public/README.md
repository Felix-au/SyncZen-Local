# public/ — Static Build Assets

This directory contains static assets bundled by Vite and used by electron-builder.

## Required Before Packaging

| File | Size | Purpose |
|---|---|---|
| `icon.ico` | 256×256 | Windows taskbar and installer icon |
| `icon.png` | 512×512 | Source PNG (convert to ICO with ImageMagick or online tools) |

## Generating an Icon

```powershell
# Using ImageMagick (install from https://imagemagick.org)
magick icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

Or use an online converter: https://convertio.co/png-ico/

Place the resulting `icon.ico` in this `public/` directory before running `npm run package`.
