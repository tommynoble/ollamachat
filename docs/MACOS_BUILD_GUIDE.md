# macOS App Build Guide

**Status:** Ready to implement  
**Complexity:** Medium  
**Time:** ~30-45 min  
**Output:** Distributable .dmg file (~80-120 MB)

---

## Current App Size

### Build Breakdown:
- JavaScript bundle: 490 KB
- CSS bundle: 33 KB
- HTML + assets: ~9 KB
- **Total web code: 532 KB**

### Final App Sizes:
| Format | Size |
|--------|------|
| macOS .app (uncompressed) | ~190 MB |
| DMG installer | ~80-120 MB |
| Zipped .app | ~60-90 MB |

---

## Prerequisites

```bash
# Already have:
- Node.js & npm ✅
- Electron ✅
- Vite build ✅

# Need to install:
npm i -D electron-builder
```

---

## Step 1: Install electron-builder

```bash
npm i -D electron-builder
```

**What it does:**
- Packages Electron app for macOS
- Creates .dmg installer
- Signs and notarizes (optional)
- Compresses efficiently

---

## Step 2: Update package.json

Add build configuration:

```json
{
  "name": "ollama-chat",
  "version": "1.0.0",
  "description": "ChatGPT-like AI on your laptop with Ollama",
  "main": "main.js",
  "homepage": "./",
  
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "dev:electron": "electron .",
    "electron-dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
    "electron-build": "npm run build && electron-builder",
    "dist": "npm run build && electron-builder --publish never"
  },

  "build": {
    "appId": "com.ollamachat.app",
    "productName": "Ollama Chat",
    "directories": {
      "buildResources": "assets",
      "output": "dist-app"
    },
    "files": [
      "dist/**/*",
      "main.js",
      "preload.js",
      "drive_detector.py",
      "node_modules/**/*",
      "package.json"
    ],
    "mac": {
      "target": [
        "dmg",
        "zip"
      ],
      "category": "public.app-category.productivity",
      "icon": "assets/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "assets/entitlements.mac.plist",
      "entitlementsInherit": "assets/entitlements.mac.plist"
    },
    "dmg": {
      "contents": [
        {
          "x": 130,
          "y": 220
        },
        {
          "x": 410,
          "y": 220,
          "type": "link",
          "path": "/Applications"
        }
      ],
      "window": {
        "width": 540,
        "height": 380
      }
    }
  }
}
```

---

## Step 3: Create App Icon (Optional but Recommended)

You need a 512x512 PNG icon:

```bash
# Convert PNG to ICNS (macOS icon format)
# Using ImageMagick or online converter
# Save as: assets/icon.icns
```

Or use a placeholder:
```bash
mkdir -p assets
# Download or create 512x512 PNG and save as assets/icon.png
```

---

## Step 4: Create Entitlements File (Optional)

**File:** `assets/entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.debugger</key>
    <true/>
</dict>
</plist>
```

---

## Step 5: Build Commands

### Development Build (for testing):
```bash
npm run electron-build
```

**Output:** 
- `dist-app/Ollama Chat-1.0.0.dmg` (~80-120 MB)
- `dist-app/Ollama Chat-1.0.0.zip` (~60-90 MB)

### Production Build (optimized):
```bash
npm run dist
```

**Same output, optimized for distribution**

---

## Step 6: Build Process

```bash
# 1. Build web assets
npm run build

# 2. Package with Electron
npm run dist

# 3. Wait for completion (2-5 minutes)
# Output in dist-app/ folder
```

---

## Step 7: Test the Built App

```bash
# Mount DMG
open dist-app/Ollama\ Chat-1.0.0.dmg

# Or run app directly
open dist-app/Ollama\ Chat-1.0.0.app

# Test functionality:
# - Chat works
# - Models load
# - External drive detected
# - Markdown renders
```

---

## Step 8: Distribution

### Option A: Direct Distribution
```bash
# Share the DMG file
dist-app/Ollama\ Chat-1.0.0.dmg
```

### Option B: GitHub Releases
```bash
# Upload to GitHub releases
# Users download and install
```

### Option C: Code Signing (Optional)
For App Store or trusted distribution:
```bash
# Requires Apple Developer account
# Add to package.json build config:
"certificateFile": "path/to/cert.p12",
"certificatePassword": "password"
```

---

## Complete Build Script

Create `build.sh`:

```bash
#!/bin/bash

echo "🔨 Building Ollama Chat for macOS..."

# Step 1: Clean
rm -rf dist dist-app

# Step 2: Build web
echo "📦 Building web assets..."
npm run build

# Step 3: Package app
echo "📱 Packaging Electron app..."
npm run dist

# Step 4: Done
echo "✅ Build complete!"
echo "📂 Output: dist-app/"
ls -lh dist-app/

# Step 5: Open folder
open dist-app/
```

Run with:
```bash
chmod +x build.sh
./build.sh
```

---

## Troubleshooting

### Issue: "Cannot find module 'drive_detector.py'"
**Solution:** Ensure `drive_detector.py` is in root directory and listed in `files` array

### Issue: Icon not showing
**Solution:** Create `assets/icon.icns` or remove icon reference

### Issue: App won't launch
**Solution:** Check main.js paths are correct for packaged app

### Issue: Large file size
**Solution:** 
- Remove unused dependencies: `npm prune --production`
- Use electron-builder compression
- Normal for Electron apps (Slack, Discord are 200-500 MB)

---

## File Structure for Build

```
ollamachat/
├── dist/                    # Web build (created by vite)
├── main.js                  # Electron main process
├── preload.js               # IPC preload
├── drive_detector.py        # Python helper
├── package.json             # With build config
├── assets/
│   ├── icon.icns           # App icon (optional)
│   └── entitlements.mac.plist
└── dist-app/               # Final output
    ├── Ollama Chat-1.0.0.dmg
    └── Ollama Chat-1.0.0.zip
```

---

## Expected Output

```
✅ Build complete!
📂 Output: dist-app/

-rw-r--r--  1 user  staff  100M Oct 29 15:00 Ollama Chat-1.0.0.dmg
-rw-r--r--  1 user  staff   75M Oct 29 15:00 Ollama Chat-1.0.0.zip
```

---

## Next Steps

1. **Install electron-builder:** `npm i -D electron-builder`
2. **Update package.json** with build config
3. **Create assets/icon.icns** (optional)
4. **Run build:** `npm run dist`
5. **Test the app:** `open dist-app/Ollama\ Chat-1.0.0.app`
6. **Distribute:** Share .dmg or .zip file

---

## Questions for Senior Dev

- Should we code-sign the app?
- Do we need App Store distribution?
- Should we add auto-updates?
- Any specific versioning strategy?
- Need to notarize for Gatekeeper?

---

**Ready to build?** 🚀
