# macOS App Build Guide - UPDATED (Senior Dev Review)

**Status:** Production Ready  
**Complexity:** Medium  
**Time:** ~45-60 min  
**Output:** Distributable .dmg file (~80-120 MB)

---

## Senior Dev Feedback Summary

✅ **90% there!** Guide is solid, but must-fix a few things before shipping.

### 🔴 Must-Fix Before Shipping
1. Don't rely on `__dirname` for bundled assets
2. Unpack executable/binary resources
3. Bundle or remove Python usage
4. Handle arm64 vs x64 architectures
5. Plan for code signing/notarization

### 🟡 Nice-to-Haves
- Artifact name pattern (nicer file names)
- Limit files in app (smaller DMG)
- First-run migration script
- Chmod +x for bundled binaries

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

---

## Step 2: Update package.json (PRODUCTION-SAFE)

**Key Changes:**
- ✅ `asar: true` - Package into ASAR archive
- ✅ `asarUnpack` - Unpack binaries outside ASAR
- ✅ `extraResources` - Include external files
- ✅ `arch: ["arm64"]` - Target Apple Silicon
- ✅ `artifactName` - Nicer file names

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
      "package.json"
    ],
    "asar": true,
    "asarUnpack": [
      "resources/**",
      "tts/**"
    ],
    "extraResources": [
      {
        "from": "resources",
        "to": "resources"
      },
      {
        "from": "tts",
        "to": "tts"
      }
    ],
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["arm64", "x64"]
        }
      ],
      "category": "public.app-category.productivity",
      "icon": "assets/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "assets/entitlements.mac.plist",
      "entitlementsInherit": "assets/entitlements.mac.plist",
      "artifactName": "${productName}-${version}-${arch}.${ext}"
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

## Step 3: Production-Safe Path Helper

**File:** `main.js` (add near top)

```javascript
const path = require('path');
const fs = require('fs');

// Production-safe path resolver
const rPath = (p) => path.join(
  app.isPackaged ? process.resourcesPath : __dirname,
  p
);

// Examples for your app:
const TTS_DIR = rPath('tts');
const PIPER_BIN = rPath(`tts/${process.platform === 'win32' ? 'piper.exe' : 'piper'}`);
const RESOURCES_DIR = rPath('resources');

// Ensure executable bit (run once on first launch)
function ensureExecutable(filePath) {
  try {
    fs.chmodSync(filePath, 0o755);
    console.log(`✅ Made executable: ${filePath}`);
  } catch (err) {
    console.warn(`⚠️ Could not chmod ${filePath}:`, err.message);
  }
}

// Call on app startup:
app.on('ready', () => {
  ensureExecutable(PIPER_BIN);
  // ... rest of your app initialization
});
```

---

## Step 4: Handle Python Usage (MUST-FIX)

### Option A: Recommended - Port to Node.js

**Current:** `drive_detector.py`  
**New:** Use Node.js equivalent

```javascript
// Instead of spawning Python, use Node.js
const { execSync } = require('child_process');

function getMountedDrives() {
  try {
    const output = execSync('diskutil list -plist', { encoding: 'utf8' });
    // Parse plist output...
    return drives;
  } catch (err) {
    console.error('Error getting drives:', err);
    return [];
  }
}
```

### Option B: Bundle Python Binary

If you must keep Python:

```bash
# Create standalone binary
pyinstaller --onefile drive_detector.py
pyinstaller --onefile rag_system.py

# Place in resources/bin/
mkdir -p resources/bin
cp dist/drive_detector resources/bin/
cp dist/rag_system resources/bin/
```

Then use in code:

```javascript
const driveDetectorBin = rPath('resources/bin/drive_detector');
const { spawn } = require('child_process');

const p = spawn(driveDetectorBin, [], { stdio: 'pipe' });
p.on('data', (data) => {
  // handle output
});
```

**Update package.json files:**
```json
"files": [
  "dist/**/*",
  "main.js",
  "preload.js",
  "package.json",
  "resources/bin/**/*"  // Include binaries
]
```

---

## Step 5: Create Entitlements File

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
    <key>com.apple.security.device.microphone</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
</dict>
</plist>
```

---

## Step 6: Create App Icon

**Requirements:**
- 512x512 PNG image
- Save as `assets/icon.png`

```bash
# Convert PNG to ICNS (macOS icon format)
# Using online converter or ImageMagick:
# sips -s format icns assets/icon.png -o assets/icon.icns

# Or use a placeholder
mkdir -p assets
# Download or create icon and save as assets/icon.icns
```

---

## Step 7: Build Commands

### Development Build (for testing):
```bash
npm run electron-build
```

**Output:**
- `dist-app/Ollama Chat-1.0.0-arm64.dmg` (~80-120 MB)
- `dist-app/Ollama Chat-1.0.0-x64.dmg` (~80-120 MB)

### Production Build (optimized):
```bash
npm run dist
```

---

## Step 8: Complete Build Script

**File:** `build.sh`

```bash
#!/bin/bash

echo "🔨 Building Ollama Chat for macOS..."

# Step 1: Clean
rm -rf dist dist-app

# Step 2: Ensure resources exist
mkdir -p resources/bin
mkdir -p tts

# Step 3: Build web
echo "📦 Building web assets..."
npm run build

# Step 4: Package app
echo "📱 Packaging Electron app..."
npm run dist

# Step 5: Done
echo "✅ Build complete!"
echo "📂 Output: dist-app/"
ls -lh dist-app/

# Step 6: Open folder
open dist-app/
```

Run with:
```bash
chmod +x build.sh
./build.sh
```

---

## Step 9: Test Checklist (Real Mac, New User)

**Before shipping, verify on a clean Mac:**

```bash
# 1. Delete app data
rm -rf ~/Library/Application\ Support/Ollama\ Chat

# 2. Install fresh
open dist-app/Ollama\ Chat-1.0.0-arm64.dmg
# Drag app to Applications

# 3. Launch app
open /Applications/Ollama\ Chat.app

# Test checklist:
✅ App launches (no "damaged" message)
✅ Chat works without dev server
✅ Markdown renders correctly
✅ External drive detected
✅ All features work
✅ No console errors
```

---

## Step 10: Code Signing & Notarization (Later)

When ready for public distribution:

```bash
# Set environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOURTEAMID"

# Update package.json:
"mac": {
  "hardenedRuntime": true,
  "entitlements": "assets/entitlements.mac.plist",
  "entitlementsInherit": "assets/entitlements.mac.plist",
  "notarize": {
    "teamId": "YOURTEAMID"
  }
}

# Build will auto-sign and notarize
npm run dist
```

---

## File Structure for Build

```
ollamachat/
├── dist/                      # Web build (created by vite)
├── main.js                    # Electron main (with rPath helper)
├── preload.js                 # IPC preload
├── package.json               # With build config
├── assets/
│   ├── icon.icns             # App icon
│   └── entitlements.mac.plist
├── resources/
│   └── bin/                   # Bundled binaries (if needed)
│       ├── drive_detector
│       └── rag_system
├── tts/
│   ├── piper                  # TTS binary (if used)
│   └── voices/                # Voice files
└── dist-app/                  # Final output
    ├── Ollama Chat-1.0.0-arm64.dmg
    └── Ollama Chat-1.0.0-x64.dmg
```

---

## Must-Fix Summary

| Issue | Fix | Status |
|-------|-----|--------|
| `__dirname` in production | Use `rPath()` helper | ⏳ Pending |
| Binaries in ASAR | Use `asarUnpack` + `extraResources` | ⏳ Pending |
| Python dependency | Port to Node or bundle binary | ⏳ Pending |
| Architecture support | Add arm64 + x64 targets | ⏳ Pending |
| Code signing | Plan for later (optional now) | ⏳ Later |

---

## Nice-to-Haves Implemented

✅ Artifact name pattern: `${productName}-${version}-${arch}.${ext}`  
✅ Limited files in app (smaller DMG)  
✅ First-run chmod +x for binaries  
✅ Production-safe path helper  

---

## Expected Output

```
✅ Build complete!
📂 Output: dist-app/

-rw-r--r--  1 user  staff  100M Oct 29 15:00 Ollama Chat-1.0.0-arm64.dmg
-rw-r--r--  1 user  staff  105M Oct 29 15:00 Ollama Chat-1.0.0-x64.dmg
```

---

## Next Steps

1. ✅ Update `package.json` with production config
2. ✅ Add `rPath()` helper to `main.js`
3. ✅ Handle Python (Option A or B)
4. ✅ Create `assets/icon.icns`
5. ✅ Create `assets/entitlements.mac.plist`
6. ✅ Run `./build.sh`
7. ✅ Test on clean Mac
8. ⏳ Code sign & notarize (when ready)

---

## Questions for Senior Dev

- Should we go with Option A (Node.js) or Option B (PyInstaller)?
- Do we need universal binary (arm64 + x64) or just arm64?
- When should we implement code signing?
- Any other must-fixes before first release?

---

**Ready to implement?** 🚀
